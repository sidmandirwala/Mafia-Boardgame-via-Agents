import React, { useState, useEffect, useRef, useMemo } from 'react';
import './App.css';

// API URL - change to match your Flask server
// Should match your Flask server
const API_URL = 'http://localhost:5001/api';

// Global loading context
const LoadingContext = React.createContext();

const LoadingProvider = ({ children }) => {
  const [loading, setLoading] = useState({ show: false, message: "Loading..." });
  
  return (
    <LoadingContext.Provider value={{ loading, setLoading }}>
      {children}
      {loading.show && <LoadingOverlay message={loading.message} />}
    </LoadingContext.Provider>
  );
};

// Hook to use the loading context
const useLoading = () => {
  const context = React.useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

// Loading overlay component
const LoadingOverlay = ({ message = "Loading..." }) => {
  return (
    <div className="loading-overlay">
      <div className="loading-container">
        <div className="loading-spinner-large"></div>
        <p className="loading-message">{message}</p>
      </div>
    </div>
  );
};

// Simplified UI components
const Card = ({ children, className }) => (
  <div className={`card ${className || ''}`}>{children}</div>
);

const CardHeader = ({ children }) => <div className="card-header">{children}</div>;
const CardTitle = ({ children }) => <h3 className="card-title">{children}</h3>;
const CardDescription = ({ children }) => <p className="card-description">{children}</p>;
const CardContent = ({ children }) => <div className="card-content">{children}</div>;
const CardFooter = ({ children }) => <div className="card-footer">{children}</div>;


const HumanPlayerCard = ({ selected, onSelect }) => {
  return (
    <div 
      className={`personality-card human-card ${selected ? 'selected' : ''}`} 
      onClick={onSelect}
    >
      <img 
        src="/static/personalities/default.jpg"
        alt="Play Yourself"
        className="personality-image"
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = "/static/personalities/default.jpg";
        }}
      />
      
      <div className="card-header">
        <h3 className="card-title">Play Yourself</h3>
        <p className="card-description">Join the game as a human player and participate in discussions and voting.</p>
      </div>
      
      <div className="card-content">
        <div className="human-card-features">
          <div className="feature-item">✓ Play as Mafia, Detective, Doctor, etc.</div>
          <div className="feature-item">✓ Participate in discussions</div>
          <div className="feature-item">✓ Make night actions</div>
          <div className="feature-item">✓ Vote to exile suspects</div>
        </div>
      </div>
    </div>
  );
};



// Replace the Button component with this enhanced version
const Button = ({ children, onClick, variant, size, disabled, isLoading, loadingText }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  const handleClick = async (e) => {
    // showTooltip tracks the in-flight async onClick; guard against double-clicks.
    if (isLoading || disabled || showTooltip) return;

    // Show loading state
    setShowTooltip(true);

    try {
      await onClick(e);
    } finally {
      // Hide loading state
      setShowTooltip(false);
    }
  };

  const busy = isLoading || showTooltip;
  
  return (
    <div className="button-container" style={{ position: 'relative' }}>
      {showTooltip && loadingText && (
        <div className="tooltip-loading">
          <div className="tooltip-spinner"></div>
          <span>{loadingText}</span>
        </div>
      )}
      <button
        className={`button ${variant || 'primary'} ${size || 'md'} ${busy ? 'button-with-loading' : ''}`}
        onClick={handleClick}
        disabled={disabled || busy}
      >
        {children}
      </button>
    </div>
  );
};

const Progress = ({ value, className }) => (
  <div className={`progress-container ${className || ''}`}>
    <div className="progress-bar" style={{ width: `${value}%` }}></div>
  </div>
);

const Badge = ({ children, variant }) => (
  <span className={`badge ${variant || 'default'}`}>{children}</span>
);

const Label = ({ children, htmlFor }) => (
  <label htmlFor={htmlFor} className="form-label">{children}</label>
);

const Input = ({ id, value, onChange }) => (
  <input 
    id={id} 
    type="text" 
    className="form-input" 
    value={value} 
    onChange={onChange} 
  />
);

const Alert = ({ children, variant }) => (
  <div className={`alert ${variant || 'default'}`}>{children}</div>
);

const AlertTitle = ({ children }) => <h4 className="alert-title">{children}</h4>;
const AlertDescription = ({ children }) => <p className="alert-description">{children}</p>;

const Slider = ({ id, value, min, max, step, onValueChange }) => (
  <input
    id={id}
    type="range"
    min={min}
    max={max}
    step={step}
    value={value[0]}
    onChange={(e) => onValueChange([parseInt(e.target.value)])}
    className="form-slider"
  />
);

// Icons
const Icon = ({ name }) => {
  const icons = {
    AlertCircle: "⚠️",
    CheckCircle: "✅",
    Skull: "☠️",
    Moon: "🌙",
    Sun: "☀️",
    Users: "👥",
    MessageSquare: "💬"
  };
  
  return <span className="icon">{icons[name] || "📌"}</span>;
};

// API functions
const fetchPersonalities = async () => {
  try {
    console.log('Fetching personalities...');
    const response = await fetch(`${API_URL}/personalities`);
    const data = await response.json();
    console.log('Received data:', data);
    return data;
  } catch (error) {
    console.error('Error fetching personalities:', error);
    return {};
  }
};

const createGame = async (personalities, isHumanPlayer = false) => {
  try {
    const response = await fetch(`${API_URL}/create_game`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        personalities,
        isHumanPlayer 
      })
    });
    return await response.json();
  } catch (error) {
    console.error('Error creating game:', error);
    return { error: 'Failed to create game' };
  }
};

const startGame = async (gameId) => {
  try {
    const response = await fetch(`${API_URL}/start_game/${gameId}`, {
      method: 'POST',
    });
    return await response.json();
  } catch (error) {
    console.error('Error starting game:', error);
    return { error: 'Failed to start game' };
  }
};

const processNight = async (gameId) => {
  try {
    const response = await fetch(`${API_URL}/process_night/${gameId}`, {
      method: 'POST',
    });
    return await response.json();
  } catch (error) {
    console.error('Error processing night:', error);
    return { error: 'Failed to process night' };
  }
};

const resolveNight = async (gameId) => {
  try {
    const response = await fetch(`${API_URL}/resolve_night/${gameId}`, {
      method: 'POST',
    });
    return await response.json();
  } catch (error) {
    console.error('Error resolving night:', error);
    return { error: 'Failed to resolve night' };
  }
};



const startDiscussion = async (gameId) => {
  try {
    const response = await fetch(`${API_URL}/start_discussion/${gameId}`, {
      method: 'POST',
    });
    return await response.json();
  } catch (error) {
    console.error('Error starting discussion:', error);
    return { error: 'Failed to start discussion' };
  }
};

const simulateDiscussion = async (gameId) => {
  try {
    const response = await fetch(`${API_URL}/simulate_discussion/${gameId}`, {
      method: 'POST',
    });
    return await response.json();
  } catch (error) {
    console.error('Error simulating discussion:', error);
    return { error: 'Failed to simulate discussion' };
  }
};

const processVoting = async (gameId) => {
  try {
    const response = await fetch(`${API_URL}/process_voting/${gameId}`, {
      method: 'POST',
    });
    return await response.json();
  } catch (error) {
    console.error('Error processing voting:', error);
    return { error: 'Failed to process voting' };
  }
};

const getGameState = async (gameId) => {
  try {
    const response = await fetch(`${API_URL}/game_state/${gameId}`);
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching game state:', error);
    return { error: 'Failed to fetch game state' };
  }
};

const resetGame = async (gameId) => {
  try {
    const response = await fetch(`${API_URL}/reset_game/${gameId}`, {
      method: 'POST',
    });
    return await response.json();
  } catch (error) {
    console.error('Error resetting game:', error);
    return { error: 'Failed to reset game' };
  }
};

// Enhanced Personality Card
const PersonalityCard = ({ personality, details, selected, onSelect, onCustomize }) => {
  // Image mapping for personalities
  const personalityImages = {
    Human: "/static/personalities/default.jpg",
    Diplomat: "/static/personalities/diplomat.png",
    Sheriff: "/static/personalities/sheriff.png",
    Conspirator: "/static/personalities/conspirator.jpg",
    Jester: "/static/personalities/jester.jpg",
    Mastermind: "/static/personalities/mastermind.jpg",
    Empath: "/static/personalities/empath.png",
    Wildcard: "/static/personalities/wildcard.jpg",
    Veteran: "/static/personalities/veteran.png",
    Innocent: "/static/personalities/innocent.jpg",
    Manipulator: "/static/personalities/manipulator.jpg"
  };

  // Debug: log image path
  const imagePath = personalityImages[personality] || "/static/personalities/default.jpg";
  
  // Add image error handling
  const [imageError, setImageError] = useState(false);
  
  const handleImageError = () => {
    console.error(`Failed to load image for ${personality}: ${imagePath}`);
    setImageError(true);
  };
  
  // Icon mapping for attributes
  const attributeIcons = {
    truthfulness: "✓",
    aggressiveness: "⚔️",
    suspicion: "🔍",
    persuasiveness: "💬",
    loyalty: "🤝",
  };
  
  const handleCardClick = () => {
    onSelect();
  };
  
  return (
    <div 
      className={`personality-card ${selected ? 'selected' : ''}`} 
      onClick={handleCardClick}
    >
      {/* Customize button in top-left corner */}
      <button 
        className="customize-button" 
        onClick={(e) => { e.stopPropagation(); onCustomize(personality); }}
      >
        Customize
      </button>
      
      {/* Show fallback if image fails or use proper image */}
      {imageError ? (
        <div className="personality-image-placeholder">
          <span className="personality-initial">{personality[0]}</span>
        </div>
      ) : (
        <img 
          src={imagePath}
          alt={personality}
          className="personality-image"
          onError={handleImageError}
        />
      )}
      
      <div className="card-header">
        <h3 className="card-title">{personality}</h3>
        <p className="card-description">{details.description}</p>
      </div>
      
      <div className="card-content">
        <div className="attributes">
          {Object.entries(details.attributes).map(([attr, value]) => (
            <div key={attr} className="personality-attribute">
              <span className="attribute-icon">{attributeIcons[attr] || "•"}</span>
              <span className="attribute-name">{attr}</span>
              <div className="attribute-bar">
                <div className="attribute-fill" style={{ width: `${value * 100}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const CustomizePersonalityModal = ({ personality, details, onSave, onCancel }) => {
  const [attributes, setAttributes] = useState(details.attributes);

  const handleAttributeChange = (attr, value) => {
    setAttributes(prev => ({ ...prev, [attr]: value[0] / 100 }));
  };

  return (
    <div className="modal-overlay">
      <Card className="modal-content">
        <CardHeader>
          <CardTitle>Customize {personality}</CardTitle>
          <CardDescription>Adjust the attributes to create your perfect personality</CardDescription>
        </CardHeader>
        <CardContent>
          {Object.entries(attributes).map(([attr, value]) => (
            <div key={attr} className="attribute-slider">
              <div className="attribute-label">
                <Label htmlFor={attr}>{attr}</Label>
                <span>{Math.round(value * 100)}%</span>
              </div>
              <Slider
                id={attr}
                value={[value * 100]}
                min={0}
                max={100}
                step={5}
                onValueChange={(val) => handleAttributeChange(attr, val)}
              />
            </div>
          ))}
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => onSave(personality, attributes)}>Save Changes</Button>
        </CardFooter>
      </Card>
    </div>
  );
};

const getScaledProfileImage = (src, size = 40) => {
  // Create a wrapper to scale images properly
  return `${src}?width=${size}&height=${size}`;
};

const ChatBubble = ({ player, message, isDead, personality, emotion }) => {
  // Get the personality image
  const personalityImages = {
    Human: "/static/personalities/default.jpg",
    Diplomat: "/static/personalities/diplomat.png",
    Sheriff: "/static/personalities/sheriff.png",
    Conspirator: "/static/personalities/conspirator.jpg",
    Jester: "/static/personalities/jester.jpg",
    Mastermind: "/static/personalities/mastermind.jpg",
    Empath: "/static/personalities/empath.png",
    Wildcard: "/static/personalities/wildcard.jpg",
    Veteran: "/static/personalities/veteran.png",
    Innocent: "/static/personalities/innocent.jpg",
    Manipulator: "/static/personalities/manipulator.jpg"
  };
  
  const [imageError, setImageError] = useState(false);
  const imagePath = personality ? personalityImages[personality] : null;
  
  const handleImageError = () => {
    console.error(`Failed to load image for ${personality}`);
    setImageError(true);
  };
  
  return (
    <div className={`chat-bubble ${isDead ? 'dead' : ''}`}>
      <div className="chat-avatar">
        {!imageError && imagePath ? (
          <img 
            src={imagePath}
            alt={personality}
            className="chat-profile-pic"
            onError={handleImageError}
            width="40"
            height="40"
          />
        ) : (
          <div className={`avatar avatar-${personality || 'Unknown'}`}>
            {personality ? personality[0] : player[0]}
          </div>
        )}
      </div>
      <div className="message">
        <div className="message-header">
          <span className="player-name">{player}</span>
          <span className="personality-badge">{personality}</span>
        </div>
        <div className="message-text">{message}</div>
      </div>
    </div>
  );
};

// 3. Enhanced Player Row with profile pictures
const PlayerRow = ({ player, newlyDead, isHumanPlayer, isHumanPlayerView, evilPartner }) => {
  // Only show roles to Player_1 if they are evil and this player is their partner
  const shouldShowRole = !isHumanPlayer || 
                        (isHumanPlayerView && player.name === "Player_1") || 
                        (isHumanPlayerView && evilPartner && player.name === evilPartner);
  
  const personalityImages = {
    Human: "/static/personalities/default.jpg",
    Diplomat: "/static/personalities/diplomat.png",
    Sheriff: "/static/personalities/sheriff.png",
    Conspirator: "/static/personalities/conspirator.jpg",
    Jester: "/static/personalities/jester.jpg",
    Mastermind: "/static/personalities/mastermind.jpg",
    Empath: "/static/personalities/empath.png",
    Wildcard: "/static/personalities/wildcard.jpg",
    Veteran: "/static/personalities/veteran.png",
    Innocent: "/static/personalities/innocent.jpg",
    Manipulator: "/static/personalities/manipulator.jpg",
    Human: "/static/personalities/default.jpg" // Add Human personality image
  };
  
  const [imageError, setImageError] = useState(false);
  const imagePath = player.personality ? personalityImages[player.personality] : null;
  
  const handleImageError = () => {
    console.error(`Failed to load image for ${player.personality}`);
    setImageError(true);
  };
  
  // Add class for evil partner highlight
  const isEvilPartner = isHumanPlayerView && evilPartner && player.name === evilPartner;
  
  return (
    <div className={`player-row ${!player.alive ? 'dead' : ''} ${newlyDead && newlyDead.includes(player.name) ? 'newly-dead' : ''} ${isEvilPartner ? 'evil-partner' : ''}`}>
      <div className="player-info">
        <div className="player-pic-container">
          {!imageError && imagePath ? (
            <img 
              src={imagePath}
              alt={player.personality}
              className="player-profile-pic"
              onError={handleImageError}
              width="40" 
              height="40"
            />
          ) : (
            <div className="player-pic-fallback">
              {player.personality ? player.personality[0] : player.name[0]}
            </div>
          )}
        </div>
        
        <div className="player-details">
          <div className={`player-name ${!player.alive ? 'dead' : ''}`}>
            {!player.alive && <Icon name="Skull" />}
            <span>{player.name}</span>
            {player.role && shouldShowRole && 
              <span className={`player-role role-${player.role.toLowerCase()}`}>{player.role}</span>
            }
            {player.role && !shouldShowRole && 
              <span className="player-role hidden-role">???</span>
            }
            {player.name === "Player_1" && isHumanPlayerView && 
              <span className="your-turn-badge">You</span>
            }
          </div>
        </div>
      </div>
      <Badge>{player.personality}</Badge>
    </div>
  );
};

const CollapsibleDiscussion = ({ discussion, gameState, lineMeta, revealCount }) => {
  // Group discussions by round
  const [expandedRounds, setExpandedRounds] = useState({});
  const [allExpanded, setAllExpanded] = useState(true);

  // Parse discussion into rounds. Each entry keeps its global index (gidx) so we can
  // look up the aligned voice metadata (emotion/audio) in lineMeta.
  const discussionByRound = useMemo(() => {
    const rounds = {};
    let currentRound = null;
    let roundMessages = [];

    discussion.forEach((line, gidx) => {
      if (line.startsWith('---')) {
        // New round
        if (currentRound && roundMessages.length) {
          rounds[currentRound] = roundMessages;
        }

        // Extract round number
        const match = line.match(/Round (\d+)/);
        currentRound = match ? parseInt(match[1]) : Object.keys(rounds).length + 1;
        roundMessages = [{ text: line, gidx }];
      } else if (currentRound !== null) {
        roundMessages.push({ text: line, gidx });
      } else {
        // Messages before any round marker
        roundMessages.push({ text: line, gidx });
      }
    });
    
    // Add the last round
    if (currentRound && roundMessages.length) {
      rounds[currentRound] = roundMessages;
    } else if (roundMessages.length) {
      rounds[1] = roundMessages;
    }
    
    return rounds;
  }, [discussion]);
  
  // Initialize expanded state for new rounds
  useEffect(() => {
    const newExpandedState = {};
    Object.keys(discussionByRound).forEach(round => {
      if (expandedRounds[round] === undefined) {
        // Auto-collapse completed rounds except the most recent
        const isLatestRound = parseInt(round) === Object.keys(discussionByRound).length;
        newExpandedState[round] = isLatestRound;
      } else {
        newExpandedState[round] = expandedRounds[round];
      }
    });
    setExpandedRounds(newExpandedState);
  }, [discussionByRound]);
  
  const toggleRound = (round) => {
    setExpandedRounds(prev => ({
      ...prev,
      [round]: !prev[round]
    }));
  };
  
  const toggleAllRounds = () => {
    const newState = !allExpanded;
    const newExpandedState = {};
    
    Object.keys(discussionByRound).forEach(round => {
      newExpandedState[round] = newState;
    });
    
    setAllExpanded(newState);
    setExpandedRounds(newExpandedState);
  };
  
  return (
    <div className="collapsible-discussion">
      <div className="discussion-controls">
        <button 
          className="toggle-all-button"
          onClick={toggleAllRounds}
        >
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>
      </div>
      
      {Object.entries(discussionByRound).map(([round, messages]) => (
        <div key={round} className="discussion-round-container">
          <div 
            className="discussion-round-header"
            onClick={() => toggleRound(round)}
          >
            <h4>Discussion Round {round}</h4>
            <span className="toggle-indicator">
              {expandedRounds[round] ? '▼' : '►'}
            </span>
          </div>
          
          {expandedRounds[round] && (
            <div className="discussion-round-content">
              {messages.map((m, i) => {
                const line = m.text;
                if (!line || line.trim() === '') {
                  return null;
                }
                // Speech-synced reveal: hide lines not yet "spoken".
                if (typeof revealCount === 'number' && m.gidx >= revealCount) {
                  return null;
                }

                if (line.startsWith('---')) {
                  return <div key={i} className="discussion-section">{line}</div>;
                }

                const colonIndex = line.indexOf(':');
                if (colonIndex > 0) {
                  const playerName = line.substring(0, colonIndex).trim();
                  const message = line.substring(colonIndex + 1).trim();
                  const player = gameState.players?.find(p => p.name === playerName);
                  const isDead = player && !player.alive;
                  const meta = lineMeta && lineMeta[m.gidx];

                  return <ChatBubble
                    key={i}
                    player={playerName}
                    message={message}
                    isDead={isDead}
                    personality={player?.personality}
                    emotion={meta && meta.emotion}
                  />;
                }

                return <div key={i} className="system-message">{line}</div>;
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// 5. Update the Typing Indicator to use profile pics too
const TypingIndicator = ({ playerName, personality }) => {
  const personalityImages = {
    Human: "/static/personalities/default.jpg",
    Diplomat: "/static/personalities/diplomat.png",
    Sheriff: "/static/personalities/sheriff.png",
    Conspirator: "/static/personalities/conspirator.jpg",
    Jester: "/static/personalities/jester.jpg",
    Mastermind: "/static/personalities/mastermind.jpg",
    Empath: "/static/personalities/empath.png",
    Wildcard: "/static/personalities/wildcard.jpg",
    Veteran: "/static/personalities/veteran.png",
    Innocent: "/static/personalities/innocent.jpg",
    Manipulator: "/static/personalities/manipulator.jpg"
  };
  
  const [imageError, setImageError] = useState(false);
  const imagePath = personality ? personalityImages[personality] : null;
  
  const handleImageError = () => {
    setImageError(true);
  };
  
  return (
    <div className="currently-typing">
      {!imageError && imagePath ? (
        <img 
          src={imagePath}
          alt={personality}
          className="typing-profile-pic"
          onError={handleImageError}
          width="32"
          height="32"
        />
      ) : (
        <div className={`avatar avatar-${personality || 'Unknown'}`}>
          {personality ? personality[0] : playerName[0]}
        </div>
      )}
      <div className="typing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <span>{playerName} is typing...</span>
    </div>
  );
};

// Add this function to categorize events
const getCategoryForEvent = (event) => {
  if (event.includes('killed') || event.includes('dead')) return 'event-kill';
  if (event.includes('Dawn')) return 'event-dawn';
  if (event.includes('Detective')) return 'event-detective';
  if (event.includes('Doctor')) return 'event-doctor';
  return 'event-game';
};

const NightActionAnimation = ({ action, target, complete, stage }) => {
  const [animationVisible, setAnimationVisible] = useState(true);
  const [targetVisible, setTargetVisible] = useState(false);
  const [fallbackActive, setFallbackActive] = useState(false);
  const animationRef = useRef(null);
  
  useEffect(() => {
    // Reset states when action changes
    setAnimationVisible(true);
    setTargetVisible(false);
    
    // Handle GIF loading error
    if (animationRef.current) {
      const img = new Image();
      img.onload = () => setFallbackActive(false);
      img.onerror = () => setFallbackActive(true);
      img.src = '/static/thinking.gif';
    }
    
    // Show target after delay
    const targetTimer = setTimeout(() => {
      if (target) {
        setTargetVisible(true);
      }
    }, 2000);
    
    // Complete animation after delay
    const completeTimer = setTimeout(() => {
      setAnimationVisible(false);
      complete();
    }, 4000);
    
    return () => {
      clearTimeout(targetTimer);
      clearTimeout(completeTimer);
    };
  }, [action, target, complete]);
  
  // Get appropriate title based on action and stage
  const getActionTitle = () => {
    if (action === 'mafia') {
      return stage === 'start' ? 'The Mafia is choosing their target...' : 'The Mafia has chosen!';
    } else if (action === 'detective') {
      return stage === 'start' ? 'The Detective is investigating...' : 'The Detective has investigated!';
    } else if (action === 'doctor') {
      return stage === 'start' ? 'The Doctor is protecting someone...' : 'The Doctor has protected!';
    }
    return '';
  };

  return (
    <div className="animation-container">
      <div className="action-title">
        {getActionTitle()}
      </div>
      
      {animationVisible ? (
        <div ref={animationRef} className={fallbackActive ? "fallback-animation" : "thinking-animation"}></div>
      ) : null}
      
      {target && (
        <div className={`target-announcement ${targetVisible ? 'visible' : ''}`}>
          <div className="target text-2xl font-bold">
            Selected: {target}
          </div>
        </div>
      )}
    </div>
  );
};

const GameSetup = ({ onStartGame }) => {
  const [personalities, setPersonalities] = useState({});
  const [selectedPersonalities, setSelectedPersonalities] = useState([]);
  const [customizing, setCustomizing] = useState(null);
  const [customPersonality, setCustomPersonality] = useState({ name: '', attributes: {} });
  const [showCustomForm, setShowCustomForm] = useState(false);
  // Add isHumanPlayer state
  const [isHumanPlayer, setIsHumanPlayer] = useState(false);
  
  const personalityImages = {
    Human: "/static/personalities/default.jpg",
    Diplomat: "/static/personalities/diplomat.png",
    Sheriff: "/static/personalities/sheriff.png",
    Conspirator: "/static/personalities/conspirator.jpg",
    Jester: "/static/personalities/jester.jpg",
    Mastermind: "/static/personalities/mastermind.jpg",
    Empath: "/static/personalities/empath.png",
    Wildcard: "/static/personalities/wildcard.jpg",
    Veteran: "/static/personalities/veteran.png",
    Innocent: "/static/personalities/innocent.jpg",
    Manipulator: "/static/personalities/manipulator.jpg"
  };

  useEffect(() => {
    const loadPersonalities = async () => {
      const data = await fetchPersonalities();
      setPersonalities(data);
    };
    
    loadPersonalities();
  }, []);

  useEffect(() => {
    // Debug image paths
    const checkImagePaths = async () => {
      if (Object.keys(personalities).length === 0) return;
      
      console.group('Debugging personality images:');
      
      // Check for "/static" folder existence
      try {
        const staticResponse = await fetch('/static');
        console.log('Static folder response:', staticResponse.status, staticResponse.ok);
      } catch (error) {
        console.error('Error checking static folder:', error);
      }
      
      // Try to fetch each image
      const personalityNames = Object.keys(personalities);
      for (const name of personalityNames) {
        const imagePath = `/static/personalities/${name.toLowerCase()}.jpg`;
        const pngPath = `/static/personalities/${name.toLowerCase()}.png`;
        
        console.log(`Checking ${name} image...`);
        
        try {
          const jpgResponse = await fetch(imagePath);
          console.log(`${name} JPG:`, jpgResponse.status, jpgResponse.ok);
        } catch (error) {
          console.error(`Error fetching ${name} JPG:`, error);
        }
        
        try {
          const pngResponse = await fetch(pngPath);
          console.log(`${name} PNG:`, pngResponse.status, pngResponse.ok);
        } catch (error) {
          console.error(`Error fetching ${name} PNG:`, error);
        }
      }
      
      // Check default image
      try {
        const defaultResponse = await fetch('/static/personalities/default.jpg');
        console.log('Default image:', defaultResponse.status, defaultResponse.ok);
      } catch (error) {
        console.error('Error fetching default image:', error);
      }
      
      console.groupEnd();
    };
    
    checkImagePaths();
  }, [personalities]);

  const handleSelectPersonality = (personality) => {
    console.log('Clicked personality:', personality);
    console.log('Current selected:', selectedPersonalities);
    
    // A game is always 6 players. With a human in the game we need 5 AI; otherwise 6.
    const maxAI = isHumanPlayer ? 5 : 6;
    if (selectedPersonalities.includes(personality)) {
      setSelectedPersonalities(prev => prev.filter(p => p !== personality));
    } else if (selectedPersonalities.length < maxAI) {
      setSelectedPersonalities(prev => [...prev, personality]);
    }
  };
  
  const handleCustomizePersonality = (personality) => {
    setCustomizing(personality);
  };
  
  const handleSaveCustomization = (personality, attributes) => {
    setPersonalities(prev => ({
      ...prev,
      [personality]: {
        ...prev[personality],
        attributes
      }
    }));
    setCustomizing(null);
  };

    // Handle human player selection
    const handleSelectHumanPlayer = () => {
      if (isHumanPlayer) {
        setIsHumanPlayer(false);
      } else {
        // Turning the human on means we now only need 5 AI — trim any extra so the
        // total never exceeds 6 (otherwise Start stays disabled with no hint why).
        setIsHumanPlayer(true);
        setSelectedPersonalities(prev => prev.slice(0, 5));
      }
    };
  
  const handleAddCustomPersonality = () => {
    if (customPersonality.name.trim() === '') return;
    
    setPersonalities(prev => ({
      ...prev,
      [customPersonality.name]: {
        description: "Custom personality",
        attributes: customPersonality.attributes,
        prompt_style: `You have a unique personality as ${customPersonality.name}.`
      }
    }));
    
    setCustomPersonality({ name: '', attributes: {} });
    setShowCustomForm(false);
  };

    // Remove a personality by clicking on its avatar
    const handleRemovePersonality = (personality, e) => {
      e.stopPropagation(); // Prevent other handlers from firing
      setSelectedPersonalities(prev => prev.filter(p => p !== personality));
    };
  
  // Modify handleStartGameClick to include human player info
  const handleStartGameClick = async () => {
    const gamePersonalities = selectedPersonalities.slice();

    // If human player is selected, we only need 5 other personalities
    await onStartGame(gamePersonalities, isHumanPlayer);
  };
  
  return (
    <div className="container">
      <Card className="setup-card">
        <CardHeader>
          <CardTitle>Mafia Game Setup</CardTitle>
          <CardDescription>Select 6 personalities for your game</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="setup-header">
            <div className="selection-info">
            <div className="selection-count">
              Selected: {isHumanPlayer ? selectedPersonalities.length + 1 : selectedPersonalities.length}/6
            </div>
              
              {/* Selected personalities avatars */}
              <div className="selected-personalities">
                {selectedPersonalities.map(personality => (
                  <img 
                    key={personality}
                    src={personalityImages[personality] || "/static/personalities/default.jpg"}
                    alt={personality}
                    title={`Remove ${personality}`}
                    className="selected-personality-avatar"
                    onClick={(e) => handleRemovePersonality(personality, e)}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "/static/personalities/default.jpg";
                    }}
                  />
                ))}
              </div>
            </div>
            
            <Button 
              disabled={isHumanPlayer ? selectedPersonalities.length !== 5 : selectedPersonalities.length !== 6} 
              onClick={handleStartGameClick}
              loadingText="Starting game..."
            >
              Start Game
            </Button>
          </div>
          
          <div className="custom-button">
            <Button variant="outline" onClick={() => setShowCustomForm(true)}>
              Create Custom Personality
            </Button>
          </div>
          
          {showCustomForm && (
            <Card className="custom-form">
              <CardHeader>
                <CardTitle>Create Custom Personality</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="form-group">
                  <Label htmlFor="name">Name</Label>
                  <Input 
                    id="name" 
                    value={customPersonality.name} 
                    onChange={(e) => setCustomPersonality(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                
                {['truthfulness', 'aggressiveness', 'suspicion', 'persuasiveness', 'loyalty'].map(attr => (
                  <div key={attr} className="attribute-slider">
                    <div className="attribute-label">
                      <Label htmlFor={attr}>{attr}</Label>
                      <span>{customPersonality.attributes[attr] ? Math.round(customPersonality.attributes[attr] * 100) : 50}%</span>
                    </div>
                    <Slider
                      id={attr}
                      value={[customPersonality.attributes[attr] ? customPersonality.attributes[attr] * 100 : 50]}
                      min={0}
                      max={100}
                      step={5}
                      onValueChange={(val) => setCustomPersonality(prev => ({ 
                        ...prev, 
                        attributes: { ...prev.attributes, [attr]: val[0] / 100 } 
                      }))}
                    />
                  </div>
                ))}
              </CardContent>
              <CardFooter>
                <Button variant="outline" onClick={() => setShowCustomForm(false)}>Cancel</Button>
                <Button onClick={handleAddCustomPersonality}>Add Personality</Button>
              </CardFooter>
            </Card>
          )}
          
          <div className="personalities-grid">
            {/* Add Human Player card at the first position */}
            <HumanPlayerCard 
              selected={isHumanPlayer}
              onSelect={handleSelectHumanPlayer}
            />
            {Object.entries(personalities).map(([personality, details]) => (
              <PersonalityCard
                key={personality}
                personality={personality}
                details={details}
                selected={selectedPersonalities.includes(personality)}
                onSelect={() => handleSelectPersonality(personality)}
                onCustomize={handleCustomizePersonality}
              />
            ))}
          </div>
        </CardContent>
      </Card>
      
      {customizing && (
        <CustomizePersonalityModal
          personality={customizing}
          details={personalities[customizing]}
          onSave={handleSaveCustomization}
          onCancel={() => setCustomizing(null)}
        />
      )}
    </div>
  );
};


// Module-level so it never remounts when GamePlay re-renders (keeps textarea focus
// and the in-progress mic recording alive).
const HumanDiscussionInput = ({ onSubmit, onSubmitAudio }) => {
  const [message, setMessage] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [sending, setSending] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const maxLength = 500;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        setRecordedBlob(new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' }));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (e) {
      alert('Microphone access denied or unavailable. You can type instead.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (sending || recording) return;
    setSending(true);
    try {
      if (recordedBlob) {
        await onSubmitAudio(recordedBlob);   // voice -> STT -> discussion
      } else if (message.trim().length > 0) {
        onSubmit(message);                    // typed text
      }
    } finally {
      setMessage("");
      setRecordedBlob(null);
      setSending(false);
    }
  };

  const canSend = !recording && (recordedBlob || message.trim().length > 0);

  return (
    <div className="human-discussion-input">
      <h3>Your Turn to Speak</h3>
      <form onSubmit={handleSubmit}>
        <div className="voice-record-row">
          {!recording ? (
            <button type="button" className="button outline md" onClick={startRecording}>
              {recordedBlob ? '🎤 Re-record' : '🎤 Record voice'}
            </button>
          ) : (
            <button type="button" className="button primary md recording-pulse" onClick={stopRecording}>
              ⏹ Stop recording
            </button>
          )}
          {recordedBlob && !recording && (
            <span className="recorded-indicator">🎙 Voice recorded — press Send to transcribe</span>
          )}
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={maxLength}
          placeholder={recordedBlob ? "Voice recorded. Send it, or type to override..." : "Speak with 🎤 Record, or type your message..."}
          rows={3}
          className="discussion-textarea"
        />
        <div className="character-count">
          {message.length}/{maxLength} characters
        </div>
        <button
          type="submit"
          className="button primary md"
          disabled={!canSend || sending}
        >
          {sending ? 'Sending...' : (recordedBlob ? 'Send Voice' : 'Send Message')}
        </button>
      </form>
    </div>
  );
};

const GamePlay = ({ gameId, isHumanPlayer }) =>
{
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nightAction, setNightAction] = useState(null);
  const [nightTarget, setNightTarget] = useState(null);
  const [discussion, setDiscussion] = useState([]);
  const [animation, setAnimation] = useState(null);
  const [showRoles, setShowRoles] = useState(true);
  const [animationStage, setAnimationStage] = useState('start');
  const [voteResults, setVoteResults] = useState({});
  const [discussionInProgress, setDiscussionInProgress] = useState(false);
  const [deadPlayers, setDeadPlayers] = useState([]);
  const [newlyDead, setNewlyDead] = useState([]);
  const [data, setData] = useState(null); // Add this line

  const [humanRole, setHumanRole] = useState(null);
  const [waitingForHuman, setWaitingForHuman] = useState(false);
  const [humanVotingActive, setHumanVotingActive] = useState(false);
  const [evilPartner, setEvilPartner] = useState(null);
  
  const [debug, setDebug] = useState({
    apiKeyStatus: "Not checked",
    agentStatus: {},
    initialized: false
  });


  // Refs
  const eventsContainerRef = useRef(null);
  const chatContainerRef = useRef(null);
  const discussionPollRef = useRef(null);

  // --- Voice playback + speech-synced text reveal ---
  const [lineMeta, setLineMeta] = useState([]);        // aligned 1:1 with `discussion`
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [playedGidx, setPlayedGidx] = useState(() => new Set()); // line indices whose audio has started
  const [revealTick, setRevealTick] = useState(0);     // periodic re-eval for the fallback timer
  const audioQueueRef = useRef([]);                    // pending {url, gidx} to play
  const audioPlayingRef = useRef(false);
  const enqueuedAudioRef = useRef(new Set());          // URLs already queued (dedupe)
  const audioElRef = useRef(null);
  const firstSeenRef = useRef({});                     // gidx -> timestamp first observed
  const AUDIO_ORIGIN = API_URL.replace(/\/api$/, '');  // backend origin for /static URLs

  const playNextAudio = () => {
    if (audioPlayingRef.current) return;
    const next = audioQueueRef.current.shift();
    if (!next) return;
    audioPlayingRef.current = true;
    const el = audioElRef.current || (audioElRef.current = new Audio());
    el.src = `${AUDIO_ORIGIN}${next.url}`;
    // Reveal this line's text EXACTLY when its audio actually starts sounding,
    // so the caption appears in sync with the voice (not before it).
    el.onplaying = () => {
      setPlayedGidx(prev => { const s = new Set(prev); s.add(next.gidx); return s; });
    };
    el.onended = el.onerror = () => { audioPlayingRef.current = false; playNextAudio(); };
    const p = el.play();
    if (p && p.catch) p.catch(() => {
      // Autoplay blocked or playback failed — reveal anyway so text isn't stuck.
      setPlayedGidx(prev => { const s = new Set(prev); s.add(next.gidx); return s; });
      audioPlayingRef.current = false;
      playNextAudio();
    });
  };

  const enqueueAudio = (url, gidx) => {
    if (!url || voiceMuted || enqueuedAudioRef.current.has(url)) return;
    enqueuedAudioRef.current.add(url);
    audioQueueRef.current.push({ url, gidx });
    playNextAudio();
  };

  // How many leading discussion lines to show: reveal a line only once its speech
  // starts (audio playing). Lines without audio (headers, human, TTS-failed) show
  // immediately; a 7s fallback prevents stalls if voice is off/unreachable.
  const computeRevealCount = () => {
    const now = Date.now();
    let count = 0;
    for (let i = 0; i < discussion.length; i++) {
      const line = discussion[i];
      if (typeof line === 'string' && line.startsWith('---')) { count++; continue; }
      if (voiceMuted) { count++; continue; }
      const meta = lineMeta[i];
      const waited = now - (firstSeenRef.current[i] || now) > 7000;
      if (meta == null) { if (waited) { count++; continue; } break; }        // synthesizing
      if (meta.audio_url && !playedGidx.has(i)) { if (waited) { count++; continue; } break; } // not yet spoken
      count++;
    }
    return count;
  };
  const revealCount = computeRevealCount();

  // Re-evaluate the reveal window periodically so the 7s fallback can fire.
  // Pause it during the human's turn so it doesn't re-render (and reset) the
  // mic recorder / voting UI every tick.
  useEffect(() => {
    // Only needed while AI lines are streaming; never during a human interaction.
    if (!discussionInProgress || waitingForHuman || humanVotingActive) return;
    const t = setInterval(() => setRevealTick(x => x + 1), 800);
    return () => clearInterval(t);
  }, [discussionInProgress, waitingForHuman, humanVotingActive]);
  
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [discussion]);

  useEffect(() => {
    if (eventsContainerRef.current) {
      eventsContainerRef.current.scrollTop = eventsContainerRef.current.scrollHeight;
    }
  }, [gameState?.events]);
  
  // Update GamePlay component's loadGameState function
  const loadGameState = async () => {
    setLoading(true);
    try {
      const state = await getGameState(gameId);
      setGameState(state);

      // If human player, set their role
      if (isHumanPlayer && state.players) {
        const humanPlayer = state.players.find(p => p.name === "Player_1");
        if (humanPlayer) {
          setHumanRole(humanPlayer.role);
          
          // If evil role, find partner
          if (humanPlayer.role === "Mafia" || humanPlayer.role === "Bad Guy") {
            const partner = state.players.find(p => 
              p.name !== "Player_1" && 
              (p.role === "Mafia" || p.role === "Bad Guy")
            );
            if (partner) {
              setEvilPartner(partner.name);
            }
          }
        }
      }
      
      // Debug agent initialization if not done yet
      if (!debug.initialized) {
        // Check API keys
        try {
          const response = await fetch(`${API_URL}/debug_api_keys`);
          const keyStatus = await response.json();
          setDebug(prev => ({
            ...prev,
            apiKeyStatus: keyStatus.status === "ok" ? "Valid" : "Invalid or missing",
            initialized: true
          }));
        } catch (err) {
          setDebug(prev => ({
            ...prev,
            apiKeyStatus: "Error checking API keys",
            initialized: true
          }));
        }
        
        // Log agent status
        if (state.players) {
          const agentStatuses = {};
          state.players.forEach(player => {
            agentStatuses[player.name] = {
              personality: player.personality,
              role: player.role || "Unknown",
              status: "Initialized"
            };
          });
          setDebug(prev => ({
            ...prev,
            agentStatus: agentStatuses
          }));
        }
      }
    } catch (err) {
      setError('Failed to load game state');
      console.error(err);
    }
    setLoading(false);
  };
  
  // Track newly dead players
// Update with proper dependency array
useEffect(() => {
  if (gameState && gameState.players) {
    const currentDead = gameState.players.filter(p => !p.alive).map(p => p.name);
    
    // Find newly dead players (dead now but weren't before)
    const newly = currentDead.filter(name => !deadPlayers.includes(name));
    if (newly.length > 0) {
      setNewlyDead(newly);
      
      // Reset newly dead after animation
      setTimeout(() => {
        setNewlyDead([]);
      }, 2000);
    }
    
    setDeadPlayers(currentDead);
  }
}, [gameState]); // Only depend on gameState, not deadPlayers

// Also check the initial game state load useEffect:
useEffect(() => {
  loadGameState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [gameId]);
  
  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (discussionPollRef.current) {
        clearInterval(discussionPollRef.current);
      }
    };
  }, []);
  
  // Check API response
  useEffect(() => {
    const fetchGameState = async () => {
      try {
        const response = await fetch(`${API_URL}/game_state/${gameId}`);
        const data = await response.json();
        console.log("Raw API Response:", data);
        console.log("Player data includes roles:", data.players.some(p => p.role));
      } catch (error) {
        console.error("Error fetching game state:", error);
      }
    };

    fetchGameState();
  }, [gameId]);
  
  const handleStartGame = async () => {
    try {
      await startGame(gameId);
      await loadGameState();
    } catch (err) {
      setError('Failed to start game');
      console.error(err);
    } 
  };
  
  const handleProcessNight = async () => {
    // Don't use the global loading overlay
    // setGlobalLoading({ show: true, message: "Processing night actions..." });
    
    // Just disable the button directly
    const nightButton = document.querySelector('.night-button');
    if (nightButton) {
      nightButton.disabled = true;
      nightButton.classList.add('button-loading');
    }
    
    try {
      // Process mafia action
      setAnimation('mafia');
      setAnimationStage('start');
      const mafiaResult = await processNight(gameId);
      setNightTarget(mafiaResult.actions.mafia_target);
      setAnimationStage('complete');
      
      // Wait for animation
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Process detective action
      setAnimation('detective');
      setAnimationStage('start');
      setNightTarget(mafiaResult.actions.detective_target);
      setAnimationStage('complete');
      
      // Wait for animation
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Process doctor action
      setAnimation('doctor');
      setAnimationStage('start');
      setNightTarget(mafiaResult.actions.doctor_target);
      setAnimationStage('complete');
      
      // Wait for animation
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      setAnimation(null);
      setNightTarget(null);
      
      // Resolve night
      await resolveNight(gameId);
      await loadGameState();
    } catch (err) {
      setError('Failed to process night');
      console.error(err);
    } finally {
      // Don't use global loading here
      // setGlobalLoading({ show: false });
      
      // Re-enable the button directly
      if (nightButton) {
        nightButton.disabled = false;
        nightButton.classList.remove('button-loading');
      }
    }
  };

  // Add this function to your GamePlay component
// Fixed handleHumanDiscussion function
const handleHumanDiscussion = async (message) => {
  try {
    console.log("Submitting human message:", message);
    
    // Send message to server
    const response = await fetch(`${API_URL}/human_discussion/${gameId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    
    const result = await response.json();
    console.log("Human discussion result:", result);

    // Hide the input immediately and resume polling so the AI turns stream in.
    setWaitingForHuman(false);
    setDiscussionInProgress(true);
    startPollingDiscussion();
  } catch (err) {
    setError('Failed to send message');
    console.error(err);

    // Resume polling even on error
    startPollingDiscussion();
  }
};

// Voice turn: send recorded mic audio -> backend Scribe(words) + Valence(emotion).
const handleHumanDiscussionAudio = async (blob) => {
  try {
    setWaitingForHuman(false);
    const fd = new FormData();
    fd.append('audio', blob, 'speech.webm');
    const response = await fetch(`${API_URL}/human_discussion_audio/${gameId}`, {
      method: 'POST',
      body: fd,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setError(err.error || 'Could not transcribe audio. Please type instead.');
      setWaitingForHuman(true); // reopen the input so they can retry / type
      return;
    }
    await response.json();
    setDiscussionInProgress(true);
    startPollingDiscussion();
  } catch (err) {
    setError('Failed to send voice message');
    console.error(err);
    setWaitingForHuman(true);
  }
};
  // Handle human night action
  const handleHumanNightAction = async (targetPlayer) => {
    try {
      // Custom API endpoint for human player night action
      const response = await fetch(`${API_URL}/human_night_action/${gameId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          role: humanRole,
          target: targetPlayer
        })
      });
      
      const result = await response.json();
      
      // Continue with AI night actions
      handleProcessNight();
    } catch (err) {
      setError('Failed to process human night action');
      console.error(err);
    }
  };

  // 4. Night Actions component for human player
  const HumanNightAction = ({ gameState, role, onSelection }) => {
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [showConfirm, setShowConfirm] = useState(false);
    
    // Get all living players except the human
    const players = gameState.players.filter(p => p.alive && p.name !== "Player_1");
    
    const getRoleActionText = () => {
      switch(role) {
        case "Mafia": return "Choose a player to eliminate:";
        case "Detective": return "Choose a player to investigate:";
        case "Doctor": return "Choose a player to protect:";
        default: return "Choose a player:";
      }
    };
    
    const handlePlayerSelect = (player) => {
      setSelectedPlayer(player);
      setShowConfirm(true);
    };
    
    const handleConfirm = () => {
      if (selectedPlayer) {
        onSelection(selectedPlayer.name);
      }
    };
    
    const handleCancel = () => {
      setSelectedPlayer(null);
      setShowConfirm(false);
    };
    
    return (
      <div className="human-night-action">
        <h3 className="action-title">{getRoleActionText()}</h3>
        
        {!showConfirm ? (
          <div className="player-selection-grid">
            {players.map(player => (
              <div 
                key={player.name}
                className="player-selection-card"
                onClick={() => handlePlayerSelect(player)}
              >
                <div className="player-pic-container">
                  <img 
                    src={`/static/personalities/${player.personality.toLowerCase()}.jpg`}
                    alt={player.personality}
                    className="player-profile-pic"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "/static/personalities/default.jpg";
                    }}
                  />
                </div>
                <div className="player-name">{player.name}</div>
                <div className="player-personality">{player.personality}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="confirm-selection">
            <p>Are you sure you want to {role === "Mafia" ? "eliminate" : role === "Detective" ? "investigate" : "protect"} {selectedPlayer.name}?</p>
            <div className="confirm-buttons">
              <Button variant="outline" onClick={handleCancel}>Cancel</Button>
              <Button onClick={handleConfirm}>Confirm</Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // HumanDiscussionInput is defined at module level (above) so it doesn't remount.

  // 6. Human Voting Component
  const HumanVoting = ({ gameState, onVote }) => {
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [showConfirm, setShowConfirm] = useState(false);
    
    // Get all living players except the human
    const players = gameState.players.filter(p => p.alive && p.name !== "Player_1");
    
    const handlePlayerSelect = (player) => {
      setSelectedPlayer(player);
      setShowConfirm(true);
    };
    
    const handleConfirm = () => {
      if (selectedPlayer) {
        onVote(selectedPlayer.name);
      }
    };
    
    const handleCancel = () => {
      setSelectedPlayer(null);
      setShowConfirm(false);
    };
    
    return (
      <div className="human-voting">
        <h3 className="voting-title">Cast Your Vote</h3>
        
        {!showConfirm ? (
          <div className="player-selection-grid">
            {players.map(player => (
              <div 
                key={player.name}
                className="player-selection-card"
                onClick={() => handlePlayerSelect(player)}
              >
                <div className="player-pic-container">
                  <img 
                    src={`/static/personalities/${player.personality.toLowerCase()}.jpg`}
                    alt={player.personality}
                    className="player-profile-pic"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "/static/personalities/default.jpg";
                    }}
                  />
                </div>
                <div className="player-name">{player.name}</div>
                <div className="player-personality">{player.personality}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="confirm-selection">
            <p>Are you sure you want to vote for {selectedPlayer.name}?</p>
            <div className="confirm-buttons">
              <Button variant="outline" onClick={handleCancel}>Cancel</Button>
              <Button onClick={handleConfirm}>Confirm Vote</Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Handle human discussion input
  // Fix 2: Add continueDiscussion function 
  const continueDiscussion = async () => {
    try {
      // Signal to the server to continue with AI discussions after human input
      const response = await fetch(`${API_URL}/continue_discussion/${gameId}`, {
        method: 'POST',
      });
      const result = await response.json();
      console.log("Continue discussion result:", result);
      
      // Continue polling for updates
      startPollingDiscussion();
    } catch (err) {
      setError('Failed to continue discussion');
      console.error(err);
    }
  };
  // Handle human voting
  const handleHumanVote = async (targetPlayer) => {
    try {
      // Record the human's vote first, then tally (AI votes + this one).
      setHumanVotingActive(false);
      const response = await fetch(`${API_URL}/human_vote/${gameId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: targetPlayer })
      });
      await response.json();

      // Now run AI voting + resolve (backend uses our recorded vote, not an AI one).
      await handleProcessVoting();
    } catch (err) {
      setError('Failed to process human vote');
      console.error(err);
    }
  };

  // Proceed-to-voting: a human picks their vote first; AI-only games tally directly.
  const handleProceedToVoting = () => {
    if (isHumanPlayer) {
      setVoteResults({});        // clear any previous round's results
      setHumanVotingActive(true);
    } else {
      handleProcessVoting();
    }
  };

  
  const resetVoiceState = () => {
    // The backend reuses line indices per day's discussion, so clear all
    // playback/reveal state (and stop any audio) when a new discussion starts.
    audioQueueRef.current = [];
    enqueuedAudioRef.current = new Set();
    audioPlayingRef.current = false;
    firstSeenRef.current = {};
    setPlayedGidx(new Set());
    if (audioElRef.current) { try { audioElRef.current.pause(); } catch (e) {} }
  };

  const handleStartDiscussion = async () => {
    console.log('Starting discussion...');
    resetVoiceState();
    setDiscussionInProgress(true);
    setDiscussion([]); // Clear any previous discussion

    const discussionButton = document.querySelector('.discussion-button');
    if (discussionButton) {
      discussionButton.disabled = true;
      discussionButton.classList.add('button-loading');
    }
    
    try {
      // First call start_discussion endpoint to change the game phase
      console.log('Calling start_discussion endpoint...');
      const startResult = await startDiscussion(gameId);
      console.log('Start discussion result:', startResult);
      
      // Then trigger the discussion simulation in background
      console.log('Calling simulate_discussion endpoint...');
      const simulateResult = await simulateDiscussion(gameId);
      console.log('Simulate discussion result:', simulateResult);
      
      // Start polling for discussion updates immediately
      console.log('Starting polling for discussion updates...');
      startPollingDiscussion();
      
      await loadGameState();
    } catch (err) {
      setError('Failed to conduct discussion');
      console.error('Error in handleStartDiscussion:', err);
      
      // Reset UI state on error
      setDiscussionInProgress(false);
      if (discussionButton) {
        discussionButton.disabled = false;
        discussionButton.classList.remove('button-loading');
      }
    }
  };
  
  const isHumanTurnToSpeak = (discussionLog) => {
    // Look for the "WAITING_FOR_HUMAN_INPUT" placeholder in the discussion log
    return discussionLog.some(msg => msg === "WAITING_FOR_HUMAN_INPUT");
  };


// Enhanced polling function with better debug
const startPollingDiscussion = () => {
  console.log("Starting discussion polling with continuous updates");
  
  if (discussionPollRef.current) {
    clearInterval(discussionPollRef.current);
  }
  
  let lastMessageCount = 0;
  
  const pollInterval = setInterval(async () => {
    try {
      const result = await fetch(`${API_URL}/discussion_status/${gameId}`);
      const responseData = await result.json();
      
      // Check for human input marker
      const isHumanInput = responseData.waiting_for_human;
      
      // Update UI with latest messages regardless of human input state
      if (responseData.discussion) {
        // Filter WAITING markers from discussion AND its aligned voice meta together,
        // so meta indices stay matched to the displayed lines.
        const rawMeta = responseData.meta || [];
        const pairs = responseData.discussion
          .map((text, i) => ({ text, meta: rawMeta[i] || null }))
          .filter(p => p.text !== "WAITING_FOR_HUMAN_INPUT");
        const cleanedDiscussion = pairs.map(p => p.text);
        const cleanedMeta = pairs.map(p => p.meta);

        // Always update display with available messages
        setDiscussion(cleanedDiscussion);
        setLineMeta(cleanedMeta);
        setData(responseData);

        // Record when each line first appeared (drives the reveal fallback timer).
        const nowTs = Date.now();
        cleanedDiscussion.forEach((_, i) => {
          if (firstSeenRef.current[i] === undefined) firstSeenRef.current[i] = nowTs;
        });

        // Queue any newly-available TTS audio (with its line index) for playback.
        cleanedMeta.forEach((m, i) => { if (m && m.audio_url) enqueueAudio(m.audio_url, i); });
        
        // Log only when new messages arrive
        if (cleanedDiscussion.length > lastMessageCount) {
          console.log(`New messages: ${cleanedDiscussion.length - lastMessageCount}`);
          lastMessageCount = cleanedDiscussion.length;
          
          // Auto-scroll
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
          }
        }
      }
      
      // Handle human input state
      if (isHumanInput) {
        setWaitingForHuman(true);
        clearInterval(discussionPollRef.current);
        discussionPollRef.current = null;
        return;
      } else {
        // No longer the human's turn — hide the input so the AI turns can show.
        setWaitingForHuman(false);
      }
      
      // Check if discussion complete
      if (!responseData.in_progress) {
        setDiscussionInProgress(false);
        clearInterval(discussionPollRef.current);
        discussionPollRef.current = null;
        
        // Re-enable discussion button
        const button = document.querySelector('.discussion-button');
        if (button) {
          button.disabled = false;
          button.classList.remove('button-loading');
        }
        
        await loadGameState();
      }
    } catch (err) {
      console.error('Error polling:', err);
    }
  }, 1000);
  
  discussionPollRef.current = pollInterval;
};
// Add this component to the React code
const DiscussionProgress = ({ current, total }) => {
  const percent = Math.min(100, Math.round((current / total) * 100));
  
  return (
    <div className="discussion-progress">
      <div className="progress-text">Discussion in progress: {percent}%</div>
      <div className="progress-container">
        <div className="progress-bar" style={{ width: `${percent}%` }}></div>
      </div>
    </div>
  );
};

// Complete fixed Discussion section JSX
const DiscussionSectionJSX = () => (
  <Card>
    <CardHeader>
      <CardTitle>
        <Icon name="MessageSquare" /> Town Discussion
      </CardTitle>
    </CardHeader>
    <CardContent>
      {discussionInProgress && data && data.progress < 100 && (
        <DiscussionProgress 
          current={data.current_count} 
          total={data.total_expected}
          nextSpeaker={data.next_speaker}
        />
      )}
      
      <div className="chat-container" ref={chatContainerRef}>
        {discussion.length === 0 && discussionInProgress ? (
          <div className="discussion-empty-state">
            <p>Waiting for players to begin discussion...</p>
          </div>
        ) : (
          discussion.map((line, i) => {
            if (!line || line.trim() === '') {
              return null;
            }
            
            if (line.startsWith('---')) {
              return <div key={i} className="discussion-section">{line}</div>;
            }
            
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
              const playerName = line.substring(0, colonIndex).trim();
              const message = line.substring(colonIndex + 1).trim();
              const player = gameState.players?.find(p => p.name === playerName);
              const isDead = player && !player.alive;
              
              return <ChatBubble 
                key={i} 
                player={playerName} 
                message={message} 
                isDead={isDead} 
                personality={player?.personality}
              />;
            }
            
            return <div key={i} className="system-message">{line}</div>;
          })
        )}
        
        {discussionInProgress && data && data.next_speaker && (
          <TypingIndicator 
            playerName={data.next_speaker} 
            personality={gameState.players?.find(p => p.name === data.next_speaker)?.personality}
          />
        )}
        
        {discussionInProgress && (!data || data.progress < 100) && (
          <div className="discussion-status">
            <div className="loading-spinner"></div>
            <p>Discussion in progress...</p>
          </div>
        )}
      </div>
    </CardContent>
    <CardFooter>
      {gameState.phase === 'discussion' && !gameState.game_over && !humanVotingActive && (
        <Button
          className="voting-button"
          onClick={handleProceedToVoting}
          isLoading={false}
          loadingText="Processing votes..."
        >
          Proceed to Voting
        </Button>
      )}
    </CardFooter>
  </Card>
);

// Fixed Players Card content
// Update the Players Card in GamePlay component
const PlayersCardContent = () => (
  <CardContent className="panel-content">
    {gameState.players?.map((player) => (
      <PlayerRow 
        key={player.name} 
        player={player} 
        newlyDead={newlyDead}
        isHumanPlayer={isHumanPlayer}
        isHumanPlayerView={isHumanPlayer && humanRole !== null}
        evilPartner={evilPartner}
      />
    ))}
  </CardContent>
);
  
  
const handleProcessVoting = async () => {
  const votingButton = document.querySelector('.voting-button');
  if (votingButton) {
    votingButton.disabled = true;
    votingButton.classList.add('button-loading');
  }
  
  try {
    const result = await processVoting(gameId);
    console.log("Voting results:", result);
    
    // Parse votes correctly
    if (result.votes) {
      // Calculate votes received by each player
      const voteCounts = {};
      
      // Initialize vote counts for all players
      gameState.players.forEach(player => {
        voteCounts[player.name] = 0;
      });
      
      // Count votes for each target
      Object.values(result.votes).forEach(target => {
        if (target && voteCounts.hasOwnProperty(target)) {
          voteCounts[target]++;
        }
      });
      
      // Store both the individual votes and the vote counts
      setVoteResults({
        individualVotes: result.votes || {},
        voteCounts: voteCounts
      });
    }
    
    await loadGameState();
  } catch (err) {
    setError('Failed to process voting');
    console.error(err);
  } finally {
    if (votingButton) {
      votingButton.disabled = false;
      votingButton.classList.remove('button-loading');
    }
  }
};

// Update the VotingGraph component to display correctly
const VotingGraph = ({ voteResults, players }) => {
  if (!voteResults || !voteResults.individualVotes || Object.keys(voteResults.individualVotes).length === 0) return null;
  
  const { individualVotes, voteCounts } = voteResults;
  
  return (
    <div className="voting-graph">
      <h3 className="voting-title">Voting Results</h3>
      <div className="voting-table">
        <div className="voting-header">
          <div className="vote-col">Votes</div>
          <div className="player-col">Player</div>
          <div className="voted-for-col">Voted For</div>
        </div>
        <div className="voting-rows-container">
          {players.map(player => (
            <div key={player.name} className="voting-row">
              <div className="vote-col">{voteCounts[player.name] || 0}</div>
              <div className="player-col">{player.name}</div>
              <div className="voted-for-col">{individualVotes[player.name] || "-"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

  const handleResetGame = async () => {
    setLoading(true);
    
    try {
      await resetGame(gameId);
      setDiscussion([]);
      setNightAction(null);
      setNightTarget(null);
      await loadGameState();
    } catch (err) {
      setError('Failed to reset game');
      console.error(err);
    } 
     
    setLoading(false);
  };

  // Loading state
  if (loading || !gameState) {
    return (
      <div className="container">
        <div className="loading">
          <div className="loading-spinner-large"></div>
          <p>Loading game state...</p>
        </div>
      </div>
    );
  }
  
  // Safer phase check
  const currentPhase = gameState?.phase || "loading";
  
  return (
    <div className="container">
      <div className="game-header">
        <div className="game-title">Mafia Game</div>
        <div className="game-phases">
          <Badge variant={gameState.phase === 'setup' ? 'default' : 'outline'}>Setup</Badge>
          <Badge variant={gameState.phase === 'night' ? 'default' : 'outline'}>Night</Badge>
          <Badge variant={gameState.phase === 'dawn' ? 'default' : 'outline'}>Dawn</Badge>
          <Badge variant={gameState.phase === 'discussion' ? 'default' : 'outline'}>Discussion</Badge>
          <Badge variant={gameState.phase === 'voting' ? 'default' : 'outline'}>Voting</Badge>
        </div>
        <div className="game-round">Round: {gameState.round || 0}</div>
      </div>
      
      {gameState.game_over && (
        <Alert className="game-over-alert">
          <Icon name="CheckCircle" />
          <AlertTitle>Game Over!</AlertTitle>
          <AlertDescription>The {gameState.winner} team wins!</AlertDescription>
        </Alert>
      )}
      
      <div className="game-dashboard">
  {/* Layout all three cards in horizontal row */}
  <div className="game-panels">
    {/* Players Card - reduced width */}
    <Card className="panel-card">
      <CardHeader>
        <CardTitle><Icon name="Users" /> Players</CardTitle>
      </CardHeader>
      <CardContent className="panel-content">
        {gameState.players?.map((player) => (
          <PlayerRow
            key={player.name}
            player={player}
            newlyDead={newlyDead}
            isHumanPlayer={isHumanPlayer}
            isHumanPlayerView={isHumanPlayer && humanRole !== null}
            evilPartner={evilPartner}
          />
        ))}
      </CardContent>
    </Card>

    {/* Game Events Card - reduced width */}
    <Card className="panel-card">
      <CardHeader>
        <CardTitle><Icon name="AlertCircle" /> Game Events</CardTitle>
      </CardHeader>
      <CardContent className="panel-content">
        <ul className="events-list" ref={eventsContainerRef}>
          {gameState.events?.map((event, i) => {
            let eventClass = 'event-game';
            let eventIcon = null;
            
            if (event.includes('Night') && event.includes('begins')) {
              eventClass = 'event-phase';
              eventIcon = '🌙';
            } else if (event.includes('Dawn of Day')) {
              eventClass = 'event-phase';
              eventIcon = '☀️';
            } else if (event.includes('Detective') && event.includes('failed')) {
              eventClass = 'event-detective-fail';
              eventIcon = '🔍❌';
            } else if (event.includes('Detective') && !event.includes('failed')) {
              eventClass = 'event-detective-success';
              eventIcon = '🔍✓';
            } else if (event.includes('killed') || event.includes('dead')) {
              eventClass = 'event-murder';
              eventIcon = '☠️';
            } else if (event.includes('Doctor') && event.includes('saved')) {
              eventClass = 'event-doctor-save';
              eventIcon = '💉';
            } else if (event.includes('exiled')) {
              eventClass = 'event-exile';
              eventIcon = '🚫';
            } else if (event.includes('Game started')) {
              eventClass = 'event-game';
              eventIcon = '🎮';
            }
            
            return (
              <li key={i} className={`event-item ${eventClass}`}>
                {eventIcon && <span className="event-icon">{eventIcon}</span>}
                {event}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>

    {/* Voting Results Card */}
    {Object.keys(voteResults).length > 0 ? (
  <Card className="panel-card">
    <CardHeader>
      <CardTitle><Icon name="Vote" /> Voting Results</CardTitle>
    </CardHeader>
    <CardContent className="panel-content">
      <VotingGraph voteResults={voteResults} players={gameState.players} />
    </CardContent>
  </Card>
) : (
  <Card className="panel-card">
    <CardHeader>
      <CardTitle><Icon name="Vote" />Voting</CardTitle>
    </CardHeader>
    <CardContent className="panel-content">
      <div className="chat-container" ref={chatContainerRef}>
        {/* Chat content */}
      </div>
    </CardContent>
  </Card>
)}
  </div>
</div>
      
      {animation && (
  <Card>
    <CardContent>
      <NightActionAnimation 
        action={animation} 
        target={nightTarget}
        stage={animationStage}
        complete={() => {}}
      />
    </CardContent>
  </Card>
)}
      
      {gameState.phase === 'setup' && (
        <Card>
          <CardContent>
            <div className="setup-prompt">
              <p>All players have been assigned personalities. Ready to begin?</p>
              <Button 
                onClick={handleStartGame}
                isLoading={false}
                loadingText="Starting game..."
              >
                Begin Game
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
{gameState.phase === 'night' && !animation && !gameState.game_over && (
  <Card>
    <CardHeader>
      <CardTitle><Icon name="Moon" /> Night Phase</CardTitle>
    </CardHeader>
    <CardContent>
      {isHumanPlayer && humanRole && (humanRole === "Mafia" || humanRole === "Detective" || humanRole === "Doctor") ? (
        <HumanNightAction
          gameState={gameState}
          role={humanRole}
          onSelection={handleHumanNightAction}
        />
      ) : (
        <div className="night-prompt">
          <p>Night has fallen. The Mafia, Detective, and Doctor will make their moves...</p>
          <Button className="night-button" onClick={handleProcessNight} loadingText="Resolving the night...">
            Process Night Actions
          </Button>
        </div>
      )}
    </CardContent>
  </Card>
)}
      
      {gameState.phase === 'dawn' && !gameState.game_over && (
 <Card>
 <CardHeader>
   <CardTitle>
     <Icon name="Sun" /> Dawn Announcement
   </CardTitle>
 </CardHeader>
 <CardContent>
   <div className="dawn-prompt">
     <p>The sun rises on a new day. Time for the town to discuss what happened.</p>
     <Button 
  className="discussion-button" 
  onClick={handleStartDiscussion}
  isLoading={false}
  loadingText="Discussion ongoing..."
>
  Begin Discussion
</Button>
   </div>
 </CardContent>
</Card>
      )}
      
      {(gameState.phase === 'discussion' || discussion.length > 0) && (
  <Card>
    <CardHeader>
      <CardTitle>
        <Icon name="MessageSquare" /> Town Discussion
        <button
          className="voice-toggle"
          title={voiceMuted ? "Unmute voices" : "Mute voices"}
          onClick={() => {
            const next = !voiceMuted;
            setVoiceMuted(next);
            if (next && audioElRef.current) { audioElRef.current.pause(); }
          }}
        >
          {voiceMuted ? '🔇' : '🔊'}
        </button>
      </CardTitle>
    </CardHeader>
    <CardContent>
      {discussionInProgress && data && data.progress < 100 && (
        <DiscussionProgress 
          current={data.current_count} 
          total={data.total_expected}
          nextSpeaker={data.next_speaker}
        />
      )}
      
      <div className="chat-container" ref={chatContainerRef}>
  {discussion.length === 0 && discussionInProgress ? (
    <div className="discussion-empty-state">
      <p>Waiting for players to begin discussion...</p>
    </div>
  ) : (
    <>
      <CollapsibleDiscussion
        discussion={discussion}
        gameState={gameState}
        lineMeta={lineMeta}
        revealCount={revealCount}
      />
      
      {waitingForHuman && (
        <HumanDiscussionInput onSubmit={handleHumanDiscussion} onSubmitAudio={handleHumanDiscussionAudio} />
      )}
    </>
  )}

  {discussionInProgress && !waitingForHuman && data && data.next_speaker && (
    <TypingIndicator 
      playerName={data.next_speaker} 
      personality={gameState.players?.find(p => p.name === data.next_speaker)?.personality}
    />
  )}
  
  {discussionInProgress && !waitingForHuman && (!data || data.progress < 100) && (
    <div className="discussion-status">
      <div className="loading-spinner"></div>
      <p>Discussion in progress...</p>
    </div>
  )}
</div>
    </CardContent>
    <CardFooter>
      {gameState.phase === 'discussion' && !gameState.game_over && !humanVotingActive && (
        <Button
          className="voting-button"
          onClick={handleProceedToVoting}
          isLoading={false}
          loadingText="Processing votes..."
        >
          Proceed to Voting
        </Button>
      )}
    </CardFooter>
  </Card>
)}

      {/* Human player's voting screen — shown after they choose Proceed to Voting */}
      {humanVotingActive && !gameState.game_over &&
        !(voteResults && voteResults.individualVotes) && (
        <Card>
          <CardHeader>
            <CardTitle><Icon name="Vote" /> Your Vote</CardTitle>
          </CardHeader>
          <CardContent>
            <HumanVoting gameState={gameState} onVote={handleHumanVote} />
          </CardContent>
        </Card>
      )}

      {gameState.game_over && (
        <div className="game-over-actions">
          <Button size="lg" onClick={handleResetGame}>Play Again</Button>
        </div>
      )}
    </div>
  );

};


const App = () => {
  const [gameId, setGameId] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  
  const [isHumanPlayer, setIsHumanPlayer] = useState(false);


// Update the handleStartGame function in App.js
const handleStartGame = async (personalities, isHuman = false) => {
  try {
    console.log(`Creating game with ${personalities.length} personalities, human player: ${isHuman}`);
    const result = await createGame(personalities, isHuman);
    if (result.game_id) {
      setGameId(result.game_id);
      setIsHumanPlayer(isHuman);
      setGameStarted(true);
    } else {
      console.error("Failed to create game:", result);
    }
  } catch (err) {
    console.error('Error starting game:', err);
  }
};

  return (
    <div className="app">
      <header className="app-header">
        <div className="container">
          <h1>AI Mafia Game</h1>
        </div>
      </header>
      
      <main className="app-main">
        {!gameStarted ? (
          <GameSetup onStartGame={handleStartGame} />
        ) : (
          <GamePlay gameId={gameId} isHumanPlayer={isHumanPlayer} />
        )}
      </main>
      
      <footer className="app-footer">
        <div className="container">
          <p>&copy; 2025 AI Mafia Game</p>
        </div>
      </footer>
    </div>
  );
};

// Wrap the entire app with LoadingProvider
const AppWithLoading = () => {
  return (
    <LoadingProvider>
      <App />
    </LoadingProvider>
  );
};

export default AppWithLoading;