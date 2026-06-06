"""
AI Mafia — Flask backend and game engine.

A social-deduction Mafia game played by LLM agents (K2-Think), with a per-character
emotional voice layer (ElevenLabs v3 TTS + Valence emotion detection). Backend API
only; the UI is the React app in mafia-game-frontend/.

Built for the Rebuild Hackathon, 2026.
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import logging
import random
import re
import time
import uuid
import itertools
from concurrent.futures import ThreadPoolExecutor, as_completed
import voice_layer  # additive emotional voice layer (TTS + Valence); fully optional
from typing import List, Dict, Any, Optional, Tuple
from dotenv import load_dotenv
from langchain_openai import AzureChatOpenAI, ChatOpenAI
# Import message classes from langchain_core so they're the exact type that
# langchain_openai's AzureChatOpenAI accepts (the old langchain.schema classes
# raise "Unsupported message type" against langchain-openai 0.0.2 / langchain-core).
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationChain
import threading
from flask import copy_current_request_context

import sys

# Setup logging with proper encoding
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("mafia_game.log", encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)


# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("mafia_game.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# ---------------------------------------------------------------------------
# LLM provider config
#
# The original Azure OpenAI resource no longer resolves in DNS, so the default
# provider is now K2-Think (an OpenAI-compatible chat API). Set LLM_PROVIDER=azure
# in a .env file to go back to Azure (you must then supply the AZURE_* vars).
# ---------------------------------------------------------------------------
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "k2").lower()

# Azure OpenAI (used only when LLM_PROVIDER=azure)
api_key = os.getenv("AZURE_OPENAI_API_KEY", "")
endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "")
azure_deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "VARELab-GPT4o")
api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview")

# K2-Think (OpenAI-compatible). Sits behind Cloudflare, which rejects the default
# Python user-agent (HTTP 1010), so we always send a browser-like User-Agent.
k2_api_key = os.getenv("K2_API_KEY", "")
k2_base_url = os.getenv("K2_BASE_URL", "https://api.k2think.ai/v1")
k2_model = os.getenv("K2_MODEL", "MBZUAI-IFM/K2-Think-v2")
k2_headers = {"User-Agent": "OpenAI/Python 1.0"}

# Optional pool of K2 keys (comma-separated in K2_API_KEYS) round-robined across
# players, so concurrent night/voting calls spread over multiple keys for
# rate-limit headroom. Falls back to the single K2_API_KEY.
k2_keys = [k.strip() for k in os.getenv("K2_API_KEYS", k2_api_key).split(",") if k.strip()]
_k2_key_cycle = itertools.cycle(k2_keys)


def build_llm():
    """Create the chat model for a player based on the configured provider."""
    if LLM_PROVIDER == "azure":
        return AzureChatOpenAI(
            azure_deployment=azure_deployment,
            api_key=api_key,
            api_version=api_version,
            azure_endpoint=endpoint,
            temperature=0.7,
            max_tokens=500,
            timeout=None,
            max_retries=2,
        )
    # Default: K2-Think. It's a reasoning model that "thinks out loud", so give it
    # plenty of tokens; the visible reasoning is stripped out in strip_reasoning().
    return ChatOpenAI(
        model=k2_model,
        api_key=next(_k2_key_cycle),
        base_url=k2_base_url,
        default_headers=k2_headers,
        temperature=0.7,
        # K2 reasons at length before the answer; too low a cap truncates it mid-
        # thought (no closing </think>) and the reasoning leaks as the "answer".
        max_tokens=8000,
        timeout=None,
        max_retries=2,
    )


def strip_reasoning(text):
    """K2-Think emits its chain-of-thought, a closing </think> tag, then the real
    answer. Return just the final answer.

    A complete K2 reply always contains </think>. If it's missing, the reply was
    truncated mid-thought (no real answer was reached), so return "" — callers
    fall back to a neutral line rather than leaking raw reasoning into the game.
    For non-reasoning providers (Azure) the whole response is the answer."""
    if not text:
        return text
    if "</think>" in text:
        return text.rsplit("</think>", 1)[-1].strip()
    if LLM_PROVIDER == "azure":
        return text.strip()
    # K2 with no </think> -> truncated, discard.
    return ""

app = Flask(__name__, static_folder="./static")
CORS(app)

# Personality templates
PERSONALITIES = {
    "Diplomat": {
        "description": "Calm, rational, and diplomatic. Tries to mediate between players and find logical solutions.",
        "attributes": {
            "truthfulness": 0.9,
            "aggressiveness": 0.2,
            "suspicion": 0.5,
            "persuasiveness": 0.8,
            "loyalty": 0.8
        },
        "prompt_style": "You are diplomatic and calm. You seek to understand all sides and mediate conflict. You speak in a composed, thoughtful manner and avoid making accusations without evidence."
    },
    "Sheriff": {
        "description": "Direct, authoritative, and justice-focused. Takes charge of investigations.",
        "attributes": {
            "truthfulness": 0.8,
            "aggressiveness": 0.7,
            "suspicion": 0.8,
            "persuasiveness": 0.6,
            "loyalty": 0.9
        },
        "prompt_style": "You are authoritative and direct. You take charge in conversations and aren't afraid to make accusations. You speak with conviction and often use imperatives."
    },
    "Conspirator": {
        "description": "Paranoid, sees connections everywhere, and questions everything.",
        "attributes": {
            "truthfulness": 0.4,
            "aggressiveness": 0.5,
            "suspicion": 1.0,
            "persuasiveness": 0.6,
            "loyalty": 0.3
        },
        "prompt_style": "You see conspiracies everywhere. You're highly suspicious and question everyone's motives, even your allies. You speak in a nervous, questioning manner with many rhetorical questions."
    },
    "Jester": {
        "description": "Humorous, light-hearted, but observant. Uses humor to deflect and observe.",
        "attributes": {
            "truthfulness": 0.7,
            "aggressiveness": 0.3,
            "suspicion": 0.6,
            "persuasiveness": 0.5,
            "loyalty": 0.6
        },
        "prompt_style": "You use humor in all situations. You deflect tension with jokes but observe carefully. You speak casually with puns and jokes while making your points."
    },
    "Mastermind": {
        "description": "Strategic, calculating, and manipulative. Thinks several steps ahead.",
        "attributes": {
            "truthfulness": 0.3,
            "aggressiveness": 0.4,
            "suspicion": 0.7,
            "persuasiveness": 0.9,
            "loyalty": 0.2
        },
        "prompt_style": "You are calculating and strategic. You plan several moves ahead and manipulate others subtly. You speak confidently but reveal only what serves your purpose."
    },
    "Empath": {
        "description": "Emotionally intelligent, reads people well, and connects with others.",
        "attributes": {
            "truthfulness": 0.9,
            "aggressiveness": 0.1,
            "suspicion": 0.6,
            "persuasiveness": 0.7,
            "loyalty": 0.8
        },
        "prompt_style": "You read emotions extremely well. You connect with others on an emotional level and speak gently. You often reference how others seem to be feeling."
    },
    "Wildcard": {
        "description": "Unpredictable, chaotic, and difficult to read. Changes strategies frequently.",
        "attributes": {
            "truthfulness": 0.5,
            "aggressiveness": 0.6,
            "suspicion": 0.5,
            "persuasiveness": 0.5,
            "loyalty": 0.4
        },
        "prompt_style": "You are unpredictable and chaotic. You change your mind frequently and seem to follow no consistent pattern. Your speech patterns vary wildly from calm to excited."
    },
    "Veteran": {
        "description": "Experienced, knowledgeable about game mechanics, and strategic.",
        "attributes": {
            "truthfulness": 0.7,
            "aggressiveness": 0.6,
            "suspicion": 0.8,
            "persuasiveness": 0.7,
            "loyalty": 0.7
        },
        "prompt_style": "You're extremely knowledgeable about how this game works. You analyze patterns methodically and speak with authority about game strategy."
    },
    "Innocent": {
        "description": "Naive, trusting, and honest. Easy to read but also easy to mislead.",
        "attributes": {
            "truthfulness": 1.0,
            "aggressiveness": 0.1,
            "suspicion": 0.2,
            "persuasiveness": 0.4,
            "loyalty": 0.9
        },
        "prompt_style": "You are naive and trusting. You believe what others tell you and rarely suspect deception. You speak honestly and directly, sharing your thoughts openly."
    },
    "Manipulator": {
        "description": "Charming, deceptive, and influential. Skilled at swaying others' opinions.",
        "attributes": {
            "truthfulness": 0.2,
            "aggressiveness": 0.3,
            "suspicion": 0.7,
            "persuasiveness": 1.0,
            "loyalty": 0.1
        },
        "prompt_style": "You are charming and manipulative. You subtly influence others while appearing helpful. You speak in a friendly, engaging manner while carefully guiding conversations."
    }
}

# Game state storage
games = {}


def display_name(p):
    """The label the AI agents see and speak for a player — their personality
    (unique per game), so dialogue/voice refers to "the Conspirator" rather than
    "Player_4". Player.name (Player_N) stays the internal identity for targeting."""
    return getattr(p, "personality", None) or p.name

class Player:
    def __init__(self, name, personality, role=None):
        self.id = str(uuid.uuid4())
        self.name = name
        self.personality = personality
        self.role = role
        self.alive = True
        # Detective's private investigation history: list of (round, target, is_mafia).
        self.investigations = []
        # Last reply WITH v3 emotion tags — used ONLY for TTS, never displayed/logged.
        self.last_tagged_reply = ""
        self.memory = ConversationBufferMemory()
        self.llm = build_llm()
        
    # Add this to the Player.get_base_prompt method in app.py:

    def get_base_prompt(self):
        # Check if personality exists in the predefined list
        if self.personality in PERSONALITIES:
            personality_info = PERSONALITIES[self.personality]
            prompt_style = personality_info['prompt_style']
        else:
            # Handle custom personalities
            prompt_style = f"You have a unique personality as {self.personality}."
            
        base_prompt = f"""
    You are playing a fun board game of Mafia with friends. Everyone at the table is known ONLY by their personality archetype — your name is "{self.personality}", and that is how the others address you. You have the personality of a {self.personality}.
    {prompt_style}

    Your current role is {self.role}. 

    Remember:
    - This is a social game about deception and deduction - nobody is actually dying or being exiled
    - You can directly question other players about their night, role, or actions
    - You can lie about your identity if it serves your strategy
    - You can blame other players for actions or accuse them based on their behavior
    - You can pretend to be a different role (like claiming to be Detective when you're not)
    - Express emotions naturally - frustration, excitement, begging others to believe you, etc.
    - Use your intuition and try to convince others to trust you
    - Keep your responses conversational and brief (2-4 lines)
    """
        
        if self.role == "Mafia":
            base_prompt += """
    You're on the evil team! Your goal is to eliminate the good players without revealing your true identity.
    - You know who the Bad Guy is and should work together with them
    - Consider lying about your role (pretending to be Detective, Doctor, or Citizen)
    - Be strategic about who you accuse - don't be too obvious about protecting your evil teammate
    - You might want to falsely claim you're Detective and "cleared" your evil teammate
    - Don't reveal your true role unless absolutely necessary or strategically advantageous
    """
        elif self.role == "Bad Guy":
            base_prompt += """
    You're on the evil team! Your goal is to eliminate the good players without revealing your true identity.
    - You know who the Mafia is and should work together with them
    - Consider lying about your role (pretending to be Detective, Doctor, or Citizen)
    - Be strategic about who you accuse - don't be too obvious about protecting your evil teammate
    - You might want to claim innocence or even pretend to suspect your evil teammate (to throw off suspicion)
    - Don't reveal your true role unless absolutely necessary or strategically advantageous
    """
        elif self.role == "Detective":
            base_prompt += """
    You're on the good team! Your goal is to identify and vote out the Mafia and Bad Guy.
    - You can investigate one player each night to determine if they're Mafia
    - You can choose whether to reveal your role or keep it secret for safety
    - You might want to share your investigation results, but be careful - revealing yourself makes you a target
    - Watch how players respond to accusations - guilty players often overreact or deflect
    - Trust your intuition and try to convince others to follow your lead
    """
        elif self.role == "Doctor":
            base_prompt += """
    You're on the good team! Your goal is to identify and vote out the Mafia and Bad Guy.
    - You can protect one player each night from being killed
    - You can choose whether to reveal your role or keep it secret for safety
    - Be careful about revealing who you protected - it gives information to the Mafia
    - Watch player behavior closely - evil players might slip up in their lies
    - Be careful who you trust with your true identity
    """
        else:  # Citizen
            base_prompt += """
    You're on the good team! Your goal is to identify and vote out the Mafia and Bad Guy.
    - You have no special night ability, but your vote is crucial
    - Listen carefully to everyone's claims and look for inconsistencies
    - Anyone could be lying about their role - trust your instincts
    - Don't be afraid to challenge suspicious behavior or statements
    - You can pretend to be a special role if it helps your strategy, but it's risky
    """
            
        return base_prompt

    def generate_response(self, context, game_state):
        role_info = f"Your role is {self.role}."
        if not self.alive:
            return "I'm dead and can't participate in the discussion."
            
        if self.role in ["Mafia", "Bad Guy"]:
            # Add information about their evil partner
            evil_partner = ""
            for player in game_state["players"]:
                if player.name != self.name and player.role in ["Mafia", "Bad Guy"]:
                    evil_partner = display_name(player)
            role_info += f" You know that {evil_partner} is your evil partner."
        elif self.role == "Detective":
            role_info += " " + self.investigation_note()

        system_prompt = f"""{self.get_base_prompt()}

        Current game state:
        - It is currently {game_state['phase']}
        - You are {self.role}
        - {role_info}
        - Living players: {', '.join([display_name(p) for p in game_state['players'] if p.alive])}
        - Dead players: {', '.join([display_name(p) for p in game_state['players'] if not p.alive])}

        Previous game events:
        {game_state['events_log']}

        Remember this is a social deduction game:
        - You can directly ask other players questions
        - You can lie about your role or actions if it helps your team
        - You can make emotional appeals or express frustration/anger
        - You can claim to have information you don't actually have
        - You can beg others to trust you or claim strong intuition

        Your goal is to survive and help your team win. If you're good (Detective, Doctor, Citizen), you want to identify and vote out the Mafia and Bad Guy. If you're evil (Mafia, Bad Guy), you want to eliminate good players without being discovered.

        IMPORTANT — stay grounded in the actual conversation:
        - The full discussion so far (this day and earlier rounds) is given below. Read it.
        - Each past line is prefixed with the speaker's Valence-detected vocal emotion,
          e.g. "[Player_3 | frustrated] You're too quiet." Use these emotional tells to
          read the table — a nervous defender may be lying, calm confidence may be a bluff.
        - Only react to things players have ACTUALLY said. Do NOT invent, quote, or
          paraphrase statements a player never made.
        - If a player has not spoken yet, do not claim they said anything. You may
          still find them suspicious for staying silent, but say so as your opinion.
        - Build on earlier rounds and respond to the most recent speakers.

        CRITICAL OUTPUT RULE — YOU MUST ADD EMOTION TAGS:
        Write your spoken reply with ElevenLabs v3 audio tags in [square brackets], placed
        immediately before the sentence they affect. EVERY sentence must start with a tag.
        Never output a plain sentence with no tag.
        Use ONLY these tags: [neutral] [calm] [confident] [nervous] [whispers] [shouts]
        [angry] [sad] [happy] [laughs] [sighs] [sarcastic] [pause]. Use 1-3 per reply.
        Ellipses (...) add hesitation; CAPS add emphasis.

        RESPOND, DON'T MIRROR — pick delivery that serves your role:
          someone angry at you -> [calm]/[confident] (look innocent, de-escalate)
          someone nervous      -> [confident] (press them)
          you're bluffing      -> [confident] (hide the tell)

        EXAMPLE
        Transcript: "[Player_2 | angry] I KNOW it's you, you've dodged every question."
        Your reply: [calm] I understand why you're upset. [confident] But accusing me
        without proof only helps the real mafia. [nervous] ...Unless that's your plan?

        Keep it to 1-3 short sentences. Do not prefix your reply with your own name.
        Output ONLY the tagged spoken line, nothing else.
        """
        
        try:
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=context)
            ]
            raw = strip_reasoning(self.llm.invoke(messages).content)
            # The UI prepends the speaker's name, so strip any leading "Player_N:"
            # the model added itself (avoids "Player_3: Player_3: ...").
            raw = re.sub(r'^\s*Player_\d+\s*:\s*', '', raw).strip()

            # Two forms of every line:
            #   tagged  -> ONLY for ElevenLabs TTS (kept on the player for the voice step)
            #   clean   -> screen + transcript + agent-readable history (tags stripped)
            tagged = voice_layer.ensure_tags(raw)
            self.last_tagged_reply = tagged
            response = voice_layer.strip_tags(tagged)
            if not response:
                # K2 reply was truncated before the answer; keep the game clean.
                response = "I need a moment to gather my thoughts..."
                self.last_tagged_reply = voice_layer.ensure_tags(response)
            # Log the CLEAN conversation (tags must never reach logs/transcript).
            logger.info(f"Player {self.name} ({self.role}) - Context: {context}")
            logger.info(f"Player {self.name} ({self.role}) - Response: {response}")
            return response
        except Exception as e:
            logger.error(f"Error generating response for {self.name}: {str(e)}")
            return "I need a moment to gather my thoughts..."

    def investigation_note(self):
        """Private summary of this Detective's past investigations for prompts."""
        if self.role != "Detective" or not self.investigations:
            return ""
        parts = [
            f"Night {inv['round']} you investigated {inv['target']} — they are "
            f"{'the MAFIA' if inv['is_mafia'] else 'NOT the mafia'}"
            for inv in self.investigations
        ]
        return ("SECRET (only you know this) — your detective investigations: "
                + "; ".join(parts) + ". Use this to steer the vote, but openly "
                "claiming to be the Detective paints a target on you.")

    def make_night_decision(self, game_state):
        living_players = [p for p in game_state["players"] if p.alive and p.name != self.name]
        if not living_players:
            return None
            
        # Agents see/choose by personality label; map back to Player_N internally.
        disp_to_name = {display_name(p): p.name for p in living_players}
        player_names = list(disp_to_name.keys())
        
        # Update night decision prompts in make_night_decision method
        if self.role == "Mafia":
            prompt = f"""
        {self.get_base_prompt()}

        It's night time - time for the Mafia to strike! Choose someone to eliminate.

        Current living players: {', '.join(player_names)}

        Think strategically about who to target:
        - Is there someone who seems suspicious of you?
        - Is the Detective or Doctor a threat to your plans?
        - Which player's elimination would cause the most confusion?

        Based on the game so far, who would you like to eliminate? Respond with ONLY the name of one player from the list above.
        """
        elif self.role == "Detective":
            prompt = f"""
        {self.get_base_prompt()}

        It's night time - time to investigate! Choose a player to determine if they're the Mafia.

        Current living players: {', '.join(player_names)}

        {self.investigation_note()}

        Think about who to investigate:
        - Don't waste a night re-checking someone you've already investigated.
        - Who acted suspiciously during discussions?
        - Who made accusations that seemed unfounded?
        - Who has been too quiet or too loud?

        Based on the game so far, who would you like to investigate? Respond with ONLY the name of one player from the list above.
        """
        elif self.role == "Doctor":
            prompt = f"""
        {self.get_base_prompt()}

        It's night time - time to protect someone! Choose a player to save from elimination.

        Current living players: {', '.join(player_names)}

        Think about who to protect:
        - Who might be targeted by the Mafia tonight?
        - Is there someone crucial to the good team's success?
        - Should you protect yourself or someone else?

        Based on the game so far, who would you like to protect? Respond with ONLY the name of one player from the list above.
        """
        else:
            return None  # Regular citizens don't make night decisions
            
        try:
            messages = [SystemMessage(content=prompt)]
            response = strip_reasoning(self.llm.invoke(messages).content)
            
            # Match the chosen personality label, return the internal Player_N.
            for label in player_names:
                if label.lower() in response.lower():
                    logger.info(f"Player {self.name} ({self.role}) chose {label}")
                    return disp_to_name[label]

            # If no valid name found, choose randomly
            random_choice = random.choice(list(disp_to_name.values()))
            logger.info(f"Player {self.name} ({self.role}) made invalid choice, randomly selecting {random_choice}")
            return random_choice

        except Exception as e:
            logger.error(f"Error in night decision for {self.name}: {str(e)}")
            return random.choice(list(disp_to_name.values()))  # Fallback to random choice

    def vote(self, game_state):
        living_players = [p for p in game_state["players"] if p.alive and p.name != self.name]
        if not living_players:
            return None
            
        # Agents see/choose by personality label; map back to Player_N internally.
        disp_to_name = {display_name(p): p.name for p in living_players}
        player_names = list(disp_to_name.keys())
        
        prompt = f"""
        {self.get_base_prompt()}

        It's time to vote! The town must decide who to exile based on your discussion.

        Current living players: {', '.join(player_names)}

        {self.investigation_note()}

        The recent discussion has included:
        {game_state['discussion_log']}

        Consider carefully:
        - Who has made inconsistent claims?
        - Who seems to be protecting suspicious players?
        - Who has failed to contribute useful information?
        - What does your gut tell you about who's evil?

        Based on the discussions, who would you vote to exile? Respond with ONLY the name of one player from the list above.
        """
        
        try:
            messages = [SystemMessage(content=prompt)]
            response = strip_reasoning(self.llm.invoke(messages).content)
            
            # Match the chosen personality label, return the internal Player_N.
            for label in player_names:
                if label.lower() in response.lower():
                    logger.info(f"Player {self.name} ({self.role}) voted for {label}")
                    return disp_to_name[label]

            # If no valid name found, choose randomly
            random_choice = random.choice(list(disp_to_name.values()))
            logger.info(f"Player {self.name} ({self.role}) made invalid vote, randomly selecting {random_choice}")
            return random_choice

        except Exception as e:
            logger.error(f"Error in voting for {self.name}: {str(e)}")
            return random.choice(list(disp_to_name.values()))  # Fallback to random choice

class Game:
    def __init__(self, game_id, personalities, has_human_player=False):
        self.id = game_id
        self.players = []
        self.phase = "setup"
        self.round = 0
        self.events_log = []
        self.discussion_log = []
        self.night_actions = {
            "mafia_target": None,
            "detective_target": None,
            "doctor_target": None
        }
        self.has_human_player = has_human_player
        # Per-discussion-line voice metadata: {discussion_log index: {speaker, emotion, audio_url}}
        self.line_meta = {}

        # Create players with selected personalities
        player_offset = 0
        if has_human_player:
            # Create human player first
            self.players.append(Player("Player_1", "Human"))
            player_offset = 1
        
        # Then add AI personalities with proper offset
        for i, personality in enumerate(personalities):
            player_name = f"Player_{i+1+player_offset}"
            self.players.append(Player(player_name, personality))

        # Assign roles once, after all players exist (was inside the loop → ran N times).
        self.assign_roles()
            
    def assign_roles(self):
        # Keep the players list in its stable display order (Player_1, Player_2, ...)
        # and shuffle the ROLES instead. Previously the players list was shuffled and
        # roles assigned in a fixed order, so the displayed list was always
        # [Mafia, Bad Guy, Detective, Doctor, Citizen, ...] — i.e. position leaked role.
        roles = ["Mafia", "Bad Guy", "Detective", "Doctor"] + ["Citizen"] * (len(self.players) - 4)
        random.shuffle(roles)
        for player, role in zip(self.players, roles):
            player.role = role
            logger.info(f"Assigned {player.name} as {player.role} with {player.personality} personality")
            
    def start_game(self):
        self.phase = "night"
        self.round = 1
        self.events_log.append(f"Game started. Round {self.round}.")
        logger.info(f"Game {self.id} started with {len(self.players)} players")
        return self.get_state()
        
    def get_state(self):
        return {
            "id": self.id,
            "players": self.players,
            "phase": self.phase,
            "round": self.round,
            "events_log": "\n".join(self.events_log),
            # Only the most recent discussion lines: bounds the prompt so K2's
            # reasoning (and latency) on votes/night decisions stays reasonable.
            # The latest lines are the round-2 closing arguments that matter most.
            "discussion_log": "\n".join(self.discussion_log[-12:]),
            "game_over": self.check_game_over()[0],
            "winner": self.check_game_over()[1]
        }
        
    def process_night(self):
        # Reset night actions
        self.night_actions = {
            "mafia_target": None,
            "detective_target": None,
            "doctor_target": None
        }
        
        # Get night actions from respective roles
        for player in self.players:
            if not player.alive:
                continue
                
            if player.role == "Mafia":
                self.night_actions["mafia_target"] = player.make_night_decision(self.get_state())
            elif player.role == "Detective":
                self.night_actions["detective_target"] = player.make_night_decision(self.get_state())
            elif player.role == "Doctor":
                self.night_actions["doctor_target"] = player.make_night_decision(self.get_state())
                
        logger.info(f"Night actions: {self.night_actions}")
        return self.night_actions
        
    def resolve_night(self):
        self.phase = "dawn"
        
        # Process detective investigation
        detective_success = False
        if self.night_actions["detective_target"]:
            target_player = next((p for p in self.players if p.name == self.night_actions["detective_target"]), None)
            if target_player:
                is_mafia = target_player.role == "Mafia"
                if is_mafia:
                    detective_success = True
                # Record the result privately on the detective so they can use it
                # in discussion and voting (otherwise the investigation is wasted).
                detective = next((p for p in self.players if p.role == "Detective" and p.alive), None)
                if detective:
                    detective.investigations.append({  # target shown by personality
                        "round": self.round,
                        "target": display_name(target_player),
                        "is_mafia": is_mafia,
                    })
                
        # Process mafia kill
        killed_player = None
        if self.night_actions["mafia_target"] and self.night_actions["mafia_target"] != self.night_actions["doctor_target"]:
            target_player = next((p for p in self.players if p.name == self.night_actions["mafia_target"]), None)
            if target_player and target_player.alive:  # never re-kill an already-dead player
                target_player.alive = False
                killed_player = target_player.name
                self.events_log.append(f"{killed_player} was killed during the night.")
        
        # Create dawn announcement
        dawn_results = {
            "detective_success": detective_success,
            "doctor_success": self.night_actions["mafia_target"] == self.night_actions["doctor_target"],
            "killed_player": killed_player
        }
        
        # Add to event log
        self.events_log.append(f"Dawn of Day {self.round}:")
        self.events_log.append(f"Detective {'' if detective_success else 'failed to'} identify the Mafia.")
        
        if dawn_results["doctor_success"] and self.night_actions["mafia_target"]:
            self.events_log.append(f"Doctor successfully saved {self.night_actions['doctor_target']}.")
        elif killed_player:
            self.events_log.append(f"{killed_player} was found dead.")
        else:
            self.events_log.append("No one died during the night.")
            
        # A night kill can end the game (evil reaches parity), so check here too.
        game_over, winner = self.check_game_over()
        if game_over:
            self.events_log.append(f"Game Over! {winner} team wins!")
            dawn_results["game_over"] = True
            dawn_results["winner"] = winner

        # Clear night actions so the next night starts fresh. The process_night
        # route only fills targets that are still empty, so without this reset a
        # dead role's stale target would persist (and re-kill) every night.
        self.night_actions = {"mafia_target": None, "detective_target": None, "doctor_target": None}

        logger.info(f"Dawn results: {dawn_results}")
        return dawn_results

    def start_discussion(self):
        self.phase = "discussion"
        self.discussion_log = []
        return self.get_state()

    # ----- Voice / emotion helpers (all best-effort; never break the game) -----
    def _save_audio(self, idx, audio_bytes):
        """Persist a line's TTS audio under static/ and return its served URL path."""
        if not audio_bytes:
            return None
        try:
            rel_dir = os.path.join("static", "audio", self.id)
            os.makedirs(rel_dir, exist_ok=True)
            path = os.path.join(rel_dir, f"{idx}.mp3")
            with open(path, "wb") as f:
                f.write(audio_bytes)
            return f"/static/audio/{self.id}/{idx}.mp3"
        except Exception as e:
            logger.error(f"Failed to save audio for line {idx}: {repr(e)[:160]}")
            return None

    def voice_line(self, idx, player):
        """Synthesize the player's last tagged reply, detect its emotion via Valence,
        and record voice metadata for discussion_log line `idx`. Tags stay voice-only."""
        if not voice_layer.VOICE_ENABLED:
            return
        try:
            res = voice_layer.voice_emotion_turn(
                player.name, player.last_tagged_reply,
                character=player.personality, is_ai=True,
            )
            audio_url = self._save_audio(idx, res.get("audio"))
            self.line_meta[idx] = {
                "speaker": display_name(player),
                "emotion": res.get("emotion"),
                "audio_url": audio_url,
            }
        except Exception as e:
            logger.error(f"voice_line failed for {player.name}: {repr(e)[:160]}")

    def emotional_history(self):
        """Discussion transcript with each line prefixed by the speaker's detected
        emotion, e.g. '[Player_3 | frustrated] ...' — the agent-readable context."""
        out = []
        for i, line in enumerate(self.discussion_log):
            if line == "WAITING_FOR_HUMAN_INPUT":
                continue
            meta = self.line_meta.get(i)
            if meta and meta.get("emotion") and ":" in line and not line.startswith("---"):
                name, text = line.split(":", 1)
                out.append(f"[{name.strip()} | {meta['emotion']}]{text}")
            else:
                out.append(line)
        return "\n".join(out)

    # Complete rewrite of simulate_discussion method
    def simulate_discussion(self, num_rounds=2):
        logger.info(f"Starting discussion for game {self.id}")
        self.discussion_log = []
        living_players = [p for p in self.players if p.alive]
        
        # Only add the first round header and wait for players to respond in sequence
        round_header = "--- Discussion Round 1 ---"
        self.discussion_log.append(round_header)
        
        # Start with the first player and let the polling system handle the rest
        self.current_speaker_index = 0
        self.current_round = 1
        
        # If first player is human, add waiting marker
        if self.has_human_player and living_players[0].name == "Player_1":
            self.discussion_log.append("WAITING_FOR_HUMAN_INPUT")
            return
        
        # Otherwise, get first AI player response
        self._get_next_ai_response()
        return

    # New method to handle sequential responses
    def _get_next_ai_response(self):
        living_players = [p for p in self.players if p.alive]
        
        # If we've gone through all players in current round
        if self.current_speaker_index >= len(living_players):
            # Move to next round if not at the final round yet (2 rounds total)
            if self.current_round < 2:
                self.current_round += 1
                self.current_speaker_index = 0
                round_header = f"--- Discussion Round {self.current_round} ---"
                self.discussion_log.append(round_header)
                
                # If first player of new round is human
                if self.has_human_player and living_players[0].name == "Player_1":
                    self.discussion_log.append("WAITING_FOR_HUMAN_INPUT")
                    return
            else:
                # Discussion complete
                logger.info("Discussion complete")
                return
        
        # Get current player
        current_player = living_players[self.current_speaker_index]
        
        # If current player is human, add waiting marker
        if self.has_human_player and current_player.name == "Player_1":
            self.discussion_log.append("WAITING_FOR_HUMAN_INPUT")
            self.current_speaker_index += 1
            return
        
        # Get appropriate topic for current round
        topic = "What do you all think happened last night? Who seems suspicious to you?"
        if self.current_round == 2:
            # Round 2 is now the final round, so make it the closing-argument prompt.
            topic = "We need to decide who to vote out. Make your final case."
        
        # Context = emotion-tagged transcript so agents read each other's vocal tells.
        previous_messages = self.emotional_history()
        logger.info(f"Getting response from {current_player.name} ({current_player.role})")

        try:
            response = current_player.generate_response(f"{topic}\n\nPrevious messages:\n{previous_messages}", self.get_state())
            logger.info(f"Response from {current_player.name}: {response[:50]}...")
            self.discussion_log.append(f"{display_name(current_player)}: {response}")
            # Speak it (tagged reply -> voice) and detect the agent's own emotion.
            self.voice_line(len(self.discussion_log) - 1, current_player)
        except Exception as e:
            logger.error(f"Error getting response from {current_player.name}: {str(e)}")
            self.discussion_log.append(f"{display_name(current_player)}: I'm thinking about what to say...")

        # Move to next player
        self.current_speaker_index += 1
        
        # Process next player with a small delay
        time.sleep(0.2)
        self._get_next_ai_response()
    
    # Make sure to add the continue_discussion_from method to the Game class if you haven't already
    def continue_discussion_from(self, current_round, current_position):
        """Continue discussion from a specific point after human input"""
        living_players = [p for p in self.players if p.alive]
            
        # Add each player's response for current round, EXCEPT human
        for player in living_players:
            # If human player, add placeholder and STOP - don't continue to next players
            if self.has_human_player and player.name == "Player_1":
                self.discussion_log.append("WAITING_FOR_HUMAN_INPUT")
                return  # Critical: Return here to pause discussion

        # Calculate which players have already spoken in this round
        spoken_players = set()
        for i in range(current_position, len(self.discussion_log)):
            line = self.discussion_log[i]
            if ":" in line:
                player_name = line.split(":")[0].strip()
                spoken_players.add(player_name)
        
        # Get remaining players for this round
        remaining_players = [p for p in living_players if p.name not in spoken_players]
        topic = "Let's continue our discussion. Who seems suspicious to you?"
        
        # Each remaining player responds for this round
        for player in remaining_players:
            # Skip human player
            if self.has_human_player and player.name == "Player_1":
                continue
                
            # Get previous messages for context
            previous_messages = self.emotional_history()
            logger.info(f"Getting response from {player.name} ({player.role})")
            
            try:
                response = player.generate_response(f"{topic}\n\nPrevious messages:\n{previous_messages}", self.get_state())
                logger.info(f"Response from {player.name}: {response[:50]}...")
                
                # Add response to log
                message = f"{display_name(player)}: {response}"
                self.discussion_log.append(message)
                self.voice_line(len(self.discussion_log) - 1, player)

                # Small delay
                time.sleep(0.2)
            except Exception as e:
                logger.error(f"Error getting response from {player.name}: {str(e)}")
                self.discussion_log.append(f"{display_name(player)}: I'm thinking about what to say...")
                time.sleep(0.2)

        # Continue with next rounds if this round is complete (2 rounds total)
        if current_round < 2:
            # Add next round header
            next_round = current_round + 1
            round_header = f"--- Discussion Round {next_round} ---"
            self.discussion_log.append(round_header)
            time.sleep(0.5)

            # Round 2 is the final round: closing arguments.
            topic = "We need to decide who to vote out. Make your final case."
            
            # Each player responds for the next round
            for player in living_players:
                # Skip human player - will be prompted by frontend
                if self.has_human_player and player.name == "Player_1":
                    self.discussion_log.append("WAITING_FOR_HUMAN_INPUT")
                    return  # Stop here and wait for human input
                    
                # Get previous messages for context
                previous_messages = self.emotional_history()
                logger.info(f"Getting response from {player.name} ({player.role})")
                
                try:
                    response = player.generate_response(f"{topic}\n\nPrevious messages:\n{previous_messages}", self.get_state())
                    logger.info(f"Response from {player.name}: {response[:50]}...")
                    
                    # Add response to log
                    message = f"{display_name(player)}: {response}"
                    self.discussion_log.append(message)
                    self.voice_line(len(self.discussion_log) - 1, player)

                    # Small delay
                    time.sleep(0.2)
                except Exception as e:
                    logger.error(f"Error getting response from {player.name}: {str(e)}")
                    self.discussion_log.append(f"{display_name(player)}: I'm thinking about what to say...")
                    time.sleep(0.2)
    
    def process_voting(self):
        self.phase = "voting"
        living_players = [p for p in self.players if p.alive]
        state = self.get_state()

        # Each living player votes once, concurrently. vote_map is voter -> target,
        # and is returned so the UI shows exactly the votes that decided the exile
        # (previously the route voted once for display and again here to decide,
        # which both doubled the LLM calls and made the two disagree).
        vote_map = {}

        # The human player votes themselves via /human_vote (stored in self.votes);
        # never let the AI vote on their behalf. Use their recorded choice as-is.
        recorded = getattr(self, "votes", {}) or {}
        ai_voters = []
        for p in living_players:
            if self.has_human_player and p.name == "Player_1":
                if recorded.get("Player_1"):
                    vote_map["Player_1"] = recorded["Player_1"]
                continue
            ai_voters.append(p)

        if ai_voters:
            with ThreadPoolExecutor(max_workers=len(ai_voters)) as ex:
                futures = {ex.submit(p.vote, state): p for p in ai_voters}
                for fut in as_completed(futures):
                    voter = futures[fut]
                    try:
                        target = fut.result()
                    except Exception as e:
                        logger.error(f"Error getting vote from {voter.name}: {str(e)}")
                        target = None
                    if target:
                        vote_map[voter.name] = target

        # Tally votes received per target
        tally = {}
        for target in vote_map.values():
            tally[target] = tally.get(target, 0) + 1

        result = {"votes": vote_map, "tally": tally}

        if tally:
            exiled_player_name = max(tally.items(), key=lambda x: x[1])[0]
            exiled_player = next((p for p in self.players if p.name == exiled_player_name), None)

            if exiled_player:
                exiled_player.alive = False
                self.events_log.append(f"{exiled_player.name} ({exiled_player.role}) was exiled from the city.")
                logger.info(f"Player {exiled_player.name} ({exiled_player.role}) was exiled")

                game_over, winner = self.check_game_over()
                if game_over:
                    self.events_log.append(f"Game Over! {winner} team wins!")
                    result.update({"exiled": exiled_player.name, "exiled_role": exiled_player.role,
                                   "game_over": True, "winner": winner})
                    return result

                # Move to next night
                self.phase = "night"
                self.round += 1
                self.events_log.append(f"Night {self.round} begins.")
                result.update({"exiled": exiled_player.name, "exiled_role": exiled_player.role,
                               "game_over": False})
                return result

        # No valid votes / tie
        self.events_log.append("No one was exiled due to a tie or invalid votes.")
        self.phase = "night"
        self.round += 1
        result.update({"exiled": None, "game_over": False})
        return result
        
    def check_game_over(self):
        living_players = [p for p in self.players if p.alive]
        good_count = sum(1 for p in living_players if p.role in ["Detective", "Doctor", "Citizen"])
        evil_count = sum(1 for p in living_players if p.role in ["Mafia", "Bad Guy"])
        
        # Evil wins if they equal or outnumber good
        if evil_count >= good_count:
            return True, "Evil"
            
        # Good wins if all evil are eliminated
        if evil_count == 0:
            return True, "Good"
            
        # Game continues
        return False, None

@app.route('/')
def index():
    # This is the API backend; the UI is the React app in mafia-game-frontend/.
    return jsonify({
        "service": "AI Mafia backend",
        "status": "ok",
        "ui": "http://localhost:3000",
    })

@app.route('/api/personalities', methods=['GET'])
def get_personalities():
    return jsonify(PERSONALITIES)



#@app.route('/api/create_game', methods=['POST'])
#def create_game():
    data = request.json
    personalities = data.get('personalities', [])
    
    if len(personalities) != 6:
        return jsonify({"error": "Please select exactly 6 personalities"}), 400
        
    game_id = str(uuid.uuid4())
    games[game_id] = Game(game_id, personalities)
    
    return jsonify({
        "game_id": game_id,
        "message": "Game created successfully"
    })

@app.route('/api/start_game/<game_id>', methods=['POST'])
def start_game(game_id):
    if game_id not in games:
        return jsonify({"error": "Game not found"}), 404
        
    game = games[game_id]
    game_state = game.start_game()
    
    return jsonify({
        "message": "Game started",
        "state": {
            "phase": game_state["phase"],
            "round": game_state["round"],
            "players": [{"name": p.name, "personality": p.personality, "alive": p.alive} for p in game_state["players"]],
            "events": game_state["events_log"]
        }
    })


# Add this endpoint to your Flask app.py file

@app.route('/api/debug_api_keys', methods=['GET'])
def debug_api_keys():
    """Check if API keys are loaded and valid."""
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    
    if not api_key or not endpoint:
        logger.warning("API keys are missing or invalid")
        return jsonify({
            "status": "error",
            "message": "API keys are missing or invalid",
            "api_key_mask": mask_string(api_key) if api_key else None,
            "endpoint_mask": mask_string(endpoint) if endpoint else None
        })
    
    logger.info("API keys loaded successfully")
    return jsonify({
        "status": "ok",
        "message": "API keys loaded successfully",
        "api_key_mask": mask_string(api_key),
        "endpoint_mask": mask_string(endpoint)
    })

def mask_string(s):
    """Mask a string to show only first and last 4 characters."""
    if not s or len(s) < 8:
        return "****"
    return s[:4] + "*" * (len(s) - 8) + s[-4:]

def game_over_response(game):
    """If the game is already decided, return a JSON response to short-circuit an
    action endpoint; otherwise None. Stops night/discussion/voting from running
    after a winner exists."""
    over, winner = game.check_game_over()
    if over:
        return jsonify({
            "error": "The game is already over.",
            "game_over": True,
            "winner": winner
        }), 409
    return None


# Modify process_night function to handle human night actions
@app.route('/api/process_night/<game_id>', methods=['POST'])
def process_night(game_id):
    if game_id not in games:
        return jsonify({"error": "Game not found"}), 404

    game = games[game_id]
    guard = game_over_response(game)
    if guard:
        return guard
    state = game.get_state()

    # Collect the night decisions that still need an AI choice (skipping dead
    # players, the human player, and any target already set this night).
    role_keys = {"Mafia": "mafia_target", "Detective": "detective_target", "Doctor": "doctor_target"}
    pending = []
    for player in game.players:
        if not player.alive:
            continue
        if game.has_human_player and player.name == "Player_1":
            # Skip human player - they'll use human_night_action endpoint
            continue
        key = role_keys.get(player.role)
        if key and not game.night_actions[key]:
            pending.append((player, key))

    # The Mafia/Detective/Doctor decisions are independent, so run them in parallel.
    if pending:
        with ThreadPoolExecutor(max_workers=len(pending)) as ex:
            futures = {ex.submit(p.make_night_decision, state): key for p, key in pending}
            for fut in as_completed(futures):
                key = futures[fut]
                try:
                    game.night_actions[key] = fut.result()
                except Exception as e:
                    logger.error(f"Error in night decision ({key}): {str(e)}")

    logger.info(f"Night actions: {game.night_actions}")
    return jsonify({
        "message": "Night actions processed",
        "actions": game.night_actions
    })

@app.route('/api/resolve_night/<game_id>', methods=['POST'])
def resolve_night(game_id):
    if game_id not in games:
        return jsonify({"error": "Game not found"}), 404
        
    game = games[game_id]
    guard = game_over_response(game)
    if guard:
        return guard
    dawn_results = game.resolve_night()
    
    return jsonify({
        "message": "Night resolved",
        "results": dawn_results,
        "state": {
            "phase": game.phase,
            "round": game.round,
            "events": game.events_log[-3:],  # Last 3 events
            "players": [{"name": p.name, "personality": p.personality, "alive": p.alive} for p in game.players]
        }
    })

@app.route('/api/start_discussion/<game_id>', methods=['POST'])
def start_discussion(game_id):
    if game_id not in games:
        return jsonify({"error": "Game not found"}), 404
        
    game = games[game_id]
    guard = game_over_response(game)
    if guard:
        return guard
    game.start_discussion()
    
    return jsonify({
        "message": "Discussion started",
        "state": {
            "phase": game.phase,
            "round": game.round
        }
    })


@app.route('/api/simulate_discussion/<game_id>', methods=['POST'])
def simulate_discussion(game_id):
    if game_id not in games:
        logger.error(f"Game {game_id} not found")
        return jsonify({"error": "Game not found"}), 404
        
    game = games[game_id]
    guard = game_over_response(game)
    if guard:
        return guard

    # Start a background thread to run the discussion simulation
    @copy_current_request_context
    def run_discussion_in_background():
        logger.info(f"Starting discussion simulation in background thread for game {game_id}")
        try:
            game.simulate_discussion()
            logger.info(f"Background discussion simulation complete for game {game_id}")
        except Exception as e:
            logger.error(f"Error in background discussion simulation: {str(e)}")
    
    # Launch the background thread
    thread = threading.Thread(target=run_discussion_in_background)
    thread.daemon = True
    thread.start()
    
    return jsonify({
        "message": "Discussion simulation started in background",
        "status": "in_progress"
    })

@app.route('/api/discussion_status/<game_id>', methods=['GET'])
def discussion_status(game_id):
    if game_id not in games:
        return jsonify({"error": "Game not found"}), 404
        
    game = games[game_id]
    
    # Get the current discussion log
    discussion = game.discussion_log
    
    # Calculate progress information
    living_players = [p for p in game.players if p.alive]
    total_players = len(living_players)
    total_rounds = 2
    expected_messages = total_players * total_rounds + total_rounds # Player messages + round headers
    
    # Count messages from each player to track who's "speaking" next
    player_counts = {}
    current_round = 1
    for line in discussion:
        if line.startswith("---") and "Round" in line:
            try:
                current_round = int(line.split("Round")[1].strip().split()[0])
            except:
                pass
        elif ":" in line:
            player_name = line.split(":")[0].strip()
            if player_name not in player_counts:
                player_counts[player_name] = 1
            else:
                player_counts[player_name] += 1
    
    # Determine who might be speaking next
    next_speaker = None
    if discussion and total_players > 0:
        for player in living_players:
            # If player hasn't spoken in the current round
            count = player_counts.get(player.name, 0)
            if count < current_round:
                next_speaker = player.name
                break
    
    # Check if discussion is still in progress
    thread_active = any(t.name.startswith("Thread-") and t.is_alive() for t in threading.enumerate())
    waiting_for_human = "WAITING_FOR_HUMAN_INPUT" in discussion
    
    # Determine if discussion is in progress based on thread status and message count
    if game.phase == "discussion" and (thread_active or len(discussion) < expected_messages or waiting_for_human):
        in_progress = True
        # Safely calculate progress percentage
        if expected_messages > 0:
            progress_percent = min(100, int((len(discussion) / expected_messages) * 100))
        else:
            progress_percent = 0
    else:
        in_progress = False
        progress_percent = 100
    
    # Debug information
    logger.info(f"Discussion status: {len(discussion)}/{expected_messages} messages, " +
                f"in_progress={in_progress}, thread_active={thread_active}, " +
                f"next_speaker={next_speaker}, progress={progress_percent}%, " +
                f"waiting_for_human={waiting_for_human}")
    
    # Voice metadata aligned 1:1 with `discussion` so the client can filter both
    # together (emotion label + audio_url per spoken line; null for headers/markers).
    meta = [game.line_meta.get(i) for i in range(len(discussion))]

    return jsonify({
        "discussion": discussion,
        "meta": meta,
        "in_progress": in_progress,
        "progress": progress_percent,
        "total_expected": expected_messages,
        "current_count": len(discussion),
        "next_speaker": next_speaker,
        "current_round": current_round,
        "waiting_for_human": waiting_for_human
    })

@app.route('/api/process_voting/<game_id>', methods=['POST'])
def process_voting(game_id):
    if game_id not in games:
        return jsonify({"error": "Game not found"}), 404
        
    game = games[game_id]
    guard = game_over_response(game)
    if guard:
        return guard

    # Single voting pass (parallel inside). The returned vote map is what both the
    # exile decision and the UI display use, so they always agree.
    voting_results = game.process_voting()
    votes = voting_results.get("votes", {})

    return jsonify({
        "message": "Voting processed",
        "results": voting_results,
        "votes": votes,  # Add votes to response
        "state": {
            "phase": game.phase,
            "round": game.round,
            "events": game.events_log[-2:],
            "players": [{"name": p.name, "personality": p.personality, "role": p.role, "alive": p.alive} for p in game.players],
            "game_over": voting_results.get("game_over", False),
            "winner": voting_results.get("winner", None)
        }
    })

@app.route('/api/game_state/<game_id>', methods=['GET'])
def get_game_state(game_id):
    if game_id not in games:
        return jsonify({"error": "Game not found"}), 404
        
    game = games[game_id]
    state = game.get_state()
    
    # This line needs to include the role attribute
    return jsonify({
        "id": state["id"],
        "phase": state["phase"],
        "round": state["round"],
        "players": [{"name": p.name, "personality": p.personality, "role": p.role, "alive": p.alive} for p in state["players"]],
        "events": state["events_log"].split("\n"),
        "discussion": state["discussion_log"].split("\n") if state["discussion_log"] else [],
        "game_over": state["game_over"],
        "winner": state["winner"]
    })

@app.route('/api/reset_game/<game_id>', methods=['POST'])
def reset_game(game_id):
    if game_id not in games:
        return jsonify({"error": "Game not found"}), 404
        
    # Get current personalities
    personalities = [p.personality for p in games[game_id].players]
    
    # Create new game with same personalities
    games[game_id] = Game(game_id, personalities)
    
    return jsonify({
        "message": "Game reset successfully",
        "game_id": game_id
    })

####################################################################################################################################
# Human player endpoints

####################################################################################################################################

@app.route('/api/human_night_action/<game_id>', methods=['POST'])
def human_night_action(game_id):
    if game_id not in games:
        return jsonify({"error": "Game not found"}), 404
        
    game = games[game_id]
    data = request.json
    role = data.get('role')
    target = data.get('target')
    
    if not role or not target:
        return jsonify({"error": "Missing role or target"}), 400
    
    # Update night actions based on the role
    if role == "Mafia":
        game.night_actions["mafia_target"] = target
    elif role == "Detective":
        game.night_actions["detective_target"] = target
    elif role == "Doctor":
        game.night_actions["doctor_target"] = target
    else:
        return jsonify({"error": "Invalid role for night action"}), 400
    
    logger.info(f"Human player with role {role} chose {target}")
    
    return jsonify({
        "message": f"Human player night action set: {role} targeting {target}",
        "status": "success"
    })

def _submit_human_message(game, message, emotion=None):
    """Shared flow for a human discussion turn (typed OR voice-transcribed):
    drop the waiting marker, append the line (+ optional detected emotion), advance
    past the human, and continue AI turns in the background."""
    # Remove waiting marker
    try:
        game.discussion_log.remove("WAITING_FOR_HUMAN_INPUT")
    except ValueError:
        logger.warning("No waiting marker found")

    game.discussion_log.append(f"Player_1: {message}")
    idx = len(game.discussion_log) - 1
    # Always record meta for the human line (emotion may be None). audio_url stays
    # None — the human's line has no TTS — so the client reveals it immediately.
    game.line_meta[idx] = {"speaker": "Player_1", "emotion": emotion, "audio_url": None}
    logger.info(f"Human player added message: {message[:50]}...")

    # Advance past the human if the speaker pointer is still on them (first speaker
    # of a round leaves it AT Player_1; without this it would just re-wait).
    living_players = [p for p in game.players if p.alive]
    if (game.current_speaker_index < len(living_players)
            and living_players[game.current_speaker_index].name == "Player_1"):
        game.current_speaker_index += 1

    @copy_current_request_context
    def continue_in_background():
        try:
            game._get_next_ai_response()
        except Exception as e:
            logger.error(f"Error continuing discussion after human input: {str(e)}")

    thread = threading.Thread(target=continue_in_background)
    thread.daemon = True
    thread.start()


# Rewrite human_discussion endpoint (typed text)
@app.route('/api/human_discussion/<game_id>', methods=['POST'])
def human_discussion(game_id):
    if game_id not in games:
        return jsonify({"error": "Game not found"}), 404

    game = games[game_id]
    data = request.json
    message = data.get('message')

    if not message:
        return jsonify({"error": "Missing message"}), 400

    _submit_human_message(game, message)
    return jsonify({"message": "Human message added", "status": "success"})


# Voice input: human records mic audio -> Scribe (words) + Valence (emotion) -> discussion
@app.route('/api/human_discussion_audio/<game_id>', methods=['POST'])
def human_discussion_audio(game_id):
    if game_id not in games:
        return jsonify({"error": "Game not found"}), 404

    game = games[game_id]
    if 'audio' not in request.files:
        return jsonify({"error": "Missing audio file"}), 400

    audio_bytes = request.files['audio'].read()
    if not audio_bytes:
        return jsonify({"error": "Empty audio"}), 400

    words = voice_layer.transcribe(audio_bytes)
    emotion = voice_layer.valence_emotion(audio_bytes)
    if not words:
        # Transcription failed/empty — let the client fall back to typing.
        return jsonify({"error": "Could not transcribe audio. Please type your message."}), 422

    _submit_human_message(game, words, emotion=emotion)
    return jsonify({"message": "Human message added", "words": words,
                    "emotion": emotion, "status": "success"})

@app.route('/api/human_vote/<game_id>', methods=['POST'])
def human_vote(game_id):
    if game_id not in games:
        return jsonify({"error": "Game not found"}), 404
        
    game = games[game_id]
    data = request.json
    target = data.get('target')
    
    if not target:
        return jsonify({"error": "Missing target"}), 400
    
    # Record the human player's vote
    # We'll assume Player_1 is always the human player
    human_player = next((p for p in game.players if p.name == "Player_1"), None)
    
    if not human_player:
        return jsonify({"error": "Human player not found"}), 400
    
    # Update votes dictionary (create one if it doesn't exist)
    if not hasattr(game, 'votes'):
        game.votes = {}
    
    game.votes["Player_1"] = target
    logger.info(f"Human player voted for {target}")
    
    return jsonify({
        "message": f"Human player vote recorded for {target}",
        "status": "success"
    })

# Modify existing endpoints to handle human player

@app.route('/api/create_game', methods=['POST'])
def create_game():
    data = request.json
    personalities = data.get('personalities', [])
    is_human_player = data.get('isHumanPlayer', False)
    
    # If human player is selected, we need only 5 AI personalities
    required_count = 5 if is_human_player else 6
    
    if len(personalities) != required_count:
        return jsonify({"error": f"Please select exactly {required_count} personalities"}), 400
        
    game_id = str(uuid.uuid4())
    games[game_id] = Game(game_id, personalities, is_human_player)
    
    return jsonify({
        "game_id": game_id,
        "message": "Game created successfully"
    })

# Add a continue_discussion endpoint for the human player flow
@app.route('/api/continue_discussion/<game_id>', methods=['POST'])
def continue_discussion(game_id):
    if game_id not in games:
        return jsonify({"error": "Game not found"}), 404
        
    game = games[game_id]
    guard = game_over_response(game)
    if guard:
        return guard

    # Remove the waiting placeholder if it exists
    game.discussion_log = [msg for msg in game.discussion_log if msg != "WAITING_FOR_HUMAN_INPUT"]
    
    # Continue the discussion simulation in the background
    @copy_current_request_context
    def continue_in_background():
        logger.info(f"Continuing discussion simulation in background thread for game {game_id}")
        try:
            # Get current round and position
            current_round = 1
            current_position = 0
            
            for i, line in enumerate(game.discussion_log):
                if line.startswith("--- Discussion Round"):
                    try:
                        current_round = int(line.split("Round")[1].strip().split()[0])
                    except:
                        pass
                    current_position = i
            
            # Continue with AI player responses for the current round
            game.continue_discussion_from(current_round, current_position)
            logger.info(f"Continued discussion simulation complete for game {game_id}")
        except Exception as e:
            logger.error(f"Error in continued discussion simulation: {str(e)}")
    
    # Launch the background thread
    thread = threading.Thread(target=continue_in_background)
    thread.daemon = True
    thread.start()
    
    return jsonify({
        "message": "Discussion continuation started",
        "status": "in_progress"
    })

####################################################################################################################################

if __name__ == '__main__':
    # Port 5000 is taken by macOS AirPlay Receiver (Control Center), so use 5001.
    app.run(debug=True, port=5001)