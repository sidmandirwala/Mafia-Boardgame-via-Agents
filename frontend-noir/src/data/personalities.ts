// Our game's 10 personality archetypes (names, tags/traits, and images) presented
// in the noir UI. `id` IS the personality name the Flask backend expects in
// /api/create_game. Portraits are served from public/static/personalities.

export type TraitKey =
  | "truthfulness"
  | "aggressiveness"
  | "suspicion"
  | "persuasiveness"
  | "loyalty";

export type Personality = {
  id: string;        // == backend personality name (e.g. "Conspirator")
  name: string;      // archetype name shown to the player
  alias: string;     // short noir epithet (flavor)
  bio: string;       // our description
  portrait: string;
  traits: Record<TraitKey, number>; // 1..5
};

export const TRAIT_LABELS: Record<TraitKey, string> = {
  truthfulness: "Truth",
  aggressiveness: "Aggression",
  suspicion: "Suspicion",
  persuasiveness: "Persuasion",
  loyalty: "Loyalty",
};

const P = "/static/personalities";

export const PERSONALITIES: Personality[] = [
  {
    id: "Conspirator",
    name: "Conspirator",
    alias: "The Paranoid",
    bio: "Paranoid, sees connections everywhere, and questions everything.",
    portrait: `${P}/Conspirator.jpg`,
    traits: { truthfulness: 2, aggressiveness: 3, suspicion: 5, persuasiveness: 3, loyalty: 2 },
  },
  {
    id: "Diplomat",
    name: "Diplomat",
    alias: "The Mediator",
    bio: "Calm, rational, and diplomatic. Tries to mediate between players and find logical solutions.",
    portrait: `${P}/diplomat.png`,
    traits: { truthfulness: 5, aggressiveness: 1, suspicion: 3, persuasiveness: 4, loyalty: 4 },
  },
  {
    id: "Empath",
    name: "Empath",
    alias: "The Reader",
    bio: "Emotionally intelligent, reads people well, and connects with others.",
    portrait: `${P}/empath.png`,
    traits: { truthfulness: 5, aggressiveness: 1, suspicion: 3, persuasiveness: 4, loyalty: 4 },
  },
  {
    id: "Innocent",
    name: "Innocent",
    alias: "The Naive",
    bio: "Naive, trusting, and honest. Easy to read but also easy to mislead.",
    portrait: `${P}/innocent.jpg`,
    traits: { truthfulness: 5, aggressiveness: 1, suspicion: 1, persuasiveness: 2, loyalty: 5 },
  },
  {
    id: "Jester",
    name: "Jester",
    alias: "The Fool",
    bio: "Humorous, light-hearted, but observant. Uses humor to deflect and observe.",
    portrait: `${P}/jester.jpg`,
    traits: { truthfulness: 4, aggressiveness: 2, suspicion: 3, persuasiveness: 3, loyalty: 3 },
  },
  {
    id: "Manipulator",
    name: "Manipulator",
    alias: "The Charmer",
    bio: "Charming, deceptive, and influential. Skilled at swaying others' opinions.",
    portrait: `${P}/manipulator.jpg`,
    traits: { truthfulness: 1, aggressiveness: 2, suspicion: 4, persuasiveness: 5, loyalty: 1 },
  },
  {
    id: "Mastermind",
    name: "Mastermind",
    alias: "The Strategist",
    bio: "Strategic, calculating, and manipulative. Thinks several steps ahead.",
    portrait: `${P}/mastermind.jpg`,
    traits: { truthfulness: 2, aggressiveness: 2, suspicion: 4, persuasiveness: 5, loyalty: 1 },
  },
  {
    id: "Sheriff",
    name: "Sheriff",
    alias: "The Lawman",
    bio: "Direct, authoritative, and justice-focused. Takes charge of investigations.",
    portrait: `${P}/sheriff.png`,
    traits: { truthfulness: 4, aggressiveness: 4, suspicion: 4, persuasiveness: 3, loyalty: 5 },
  },
  {
    id: "Veteran",
    name: "Veteran",
    alias: "The Old Hand",
    bio: "Experienced, knowledgeable about game mechanics, and strategic.",
    portrait: `${P}/veteran.png`,
    traits: { truthfulness: 4, aggressiveness: 3, suspicion: 4, persuasiveness: 4, loyalty: 4 },
  },
  {
    id: "Wildcard",
    name: "Wildcard",
    alias: "The Loose Cannon",
    bio: "Unpredictable, chaotic, and difficult to read. Changes strategies frequently.",
    portrait: `${P}/wildcard.jpg`,
    traits: { truthfulness: 3, aggressiveness: 3, suspicion: 3, persuasiveness: 3, loyalty: 2 },
  },
];

export const MAX_SELECTED = 6;
