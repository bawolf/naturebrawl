import React, { useState, useEffect, useRef } from 'react';
import { getSpeciesName } from '../lib/species';
import { SSEClient } from '../lib/sse-client';

interface Character {
  id: string;
  species: string;
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  browserId: string;
  attacks: Attack[];
}

interface Attack {
  id: string;
  name: string;
  damage: number;
  energyCost: number;
  criticalHitChance: number;
}

interface GameState {
  player1: Character;
  player2: Character;
  currentPlayer: string;
  gamePhase: 'waiting' | 'active' | 'finished';
  turnNumber: number;
  winner?: string | null;
}

interface BattleMessage {
  id: string;
  message: string;
  type: 'info' | 'attack' | 'miss' | 'victory' | 'error' | 'warning';
  timestamp: Date;
}

interface BattleInterfaceProps {
  slug: string;
  initialGameState: GameState | null;
  myCharacterId: string; // Can be "BROWSER_DETERMINED" to determine from localStorage
  browserId: string; // Can be "BROWSER_DETERMINED" to determine from localStorage
  currentImageUrl?: string;
}

interface HealthBarProps {
  label: string;
  current: number;
  max: number;
  isEnemy?: boolean;
}

const HealthBar: React.FC<HealthBarProps> = ({
  label,
  current,
  max,
  isEnemy = false,
}) => (
  <div
    className={`w-full md:w-5/12 p-2 bg-gray-200 border-2 border-black rounded-lg shadow-md ${isEnemy ? 'text-right' : ''}`}
  >
    <div className="flex justify-between items-center mb-1">
      <span className="text-xs font-bold text-black">{label}</span>
      <span className="text-xs text-black">
        {current} / {max} HP
      </span>
    </div>
    <div className="w-full bg-gray-400 rounded-full h-4 border border-black overflow-hidden">
      <div
        className="bg-green-500 h-full transition-all duration-500"
        style={{ width: `${Math.max(0, (current / max) * 100)}%` }}
      ></div>
    </div>
  </div>
);

export default function BattleInterface({
  slug,
  initialGameState,
  myCharacterId: propMyCharacterId,
  browserId: propBrowserId,
  currentImageUrl,
}: BattleInterfaceProps) {
  // Determine browser ID and character ID
  const getBrowserId = () => {
    if (typeof window === 'undefined') return '';
    let browserId = localStorage.getItem('naturebrawl.browserId');
    if (!browserId) {
      browserId = 'browser_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('naturebrawl.browserId', browserId);
    }
    return browserId;
  };

  const browserId =
    propBrowserId === 'BROWSER_DETERMINED' ? getBrowserId() : propBrowserId;

  // Determine which character is mine based on browser ID
  const getMyCharacterId = () => {
    if (propMyCharacterId !== 'BROWSER_DETERMINED') return propMyCharacterId;
    if (!initialGameState || !browserId) return '';

    // Check which character belongs to this browser
    if (initialGameState.player1.browserId === browserId)
      return initialGameState.player1.id;
    if (initialGameState.player2.browserId === browserId)
      return initialGameState.player2.id;

    // Fallback to player1 if no match (shouldn't happen in normal flow)
    return initialGameState.player1.id;
  };

  const myCharacterId = getMyCharacterId();

  const [gameState, setGameState] = useState<GameState | null>(
    initialGameState
  );
  const [battleMessages, setBattleMessages] = useState<BattleMessage[]>([]);
  const [processingAttackId, setProcessingAttackId] = useState<string | null>(
    null
  );
  const [isHydrated, setIsHydrated] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Derived state
  const myCharacter = gameState
    ? gameState.player1.id === myCharacterId
      ? gameState.player1
      : gameState.player2
    : null;
  const enemyCharacter = gameState
    ? gameState.player1.id === myCharacterId
      ? gameState.player2
      : gameState.player1
    : null;
  const isPlayer1Me = myCharacter?.id === gameState?.player1.id;
  const isMyTurn = isHydrated
    ? gameState?.currentPlayer === myCharacterId
    : false;

  // Layout classes based on player position
  const layoutClasses = {
    // Match character positions in generated images:
    // Player 1 = right side, Player 2 = left side
    playerHealth: isPlayer1Me ? 'bottom-4 right-4' : 'bottom-4 left-4',
    enemyHealth: isPlayer1Me ? 'bottom-4 left-4' : 'bottom-4 right-4',
    turnIndicator: 'top-4 right-4',
    currentPlayerIndicator: 'top-4 left-4',
  };

  // Set hydrated state on mount to fix hydration issues
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Load battle events from database on mount
  useEffect(() => {
    const loadBattleEvents = async () => {
      if (!slug) return;

      try {
        const response = await fetch(`/api/brawls/${slug}/events`);
        if (response.ok) {
          const { events } = await response.json();

          // Convert database events to BattleMessage format
          const messages: BattleMessage[] = events.map((event: any) => ({
            id: event.id,
            message: event.message,
            type: event.eventType,
            timestamp: new Date(event.createdAt),
          }));

          // If no events, add the default message
          if (messages.length === 0) {
            messages.push({
              id: '1',
              message: '⚔️ Battle begins! Choose your move!',
              type: 'info',
              timestamp: new Date(),
            });
          }

          setBattleMessages(messages);
        }
      } catch (error) {
        console.error('Error loading battle events:', error);
        // Fallback to default message
        setBattleMessages([
          {
            id: '1',
            message: '⚔️ Battle begins! Choose your move!',
            type: 'info',
            timestamp: new Date(),
          },
        ]);
      }
    };

    loadBattleEvents();
  }, [slug]);

  // Setup SSE connection
  useEffect(() => {
    if (!slug) return;

    console.log('BattleInterface: Setting up SSE connection for fight:', slug);

    const client = new SSEClient(slug);

    const handleChallengeAccepted = () => {
      window.location.reload();
    };

    const handleAttackResultEvent = (data: any) => {
      handleAttackResult(data.attackResult, data.gameState);
    };

    const handleImageUpdated = (data: any) => {
      handleImageUpdate(data.imageUrl, data.turnNumber);
    };

    const handleImageFailed = (data: any) => {
      console.warn('Image generation failed:', data.error);
      addBattleMessage(`⚠️ Image generation failed: ${data.error}`, 'warning');
    };

    // Subscribe to events
    client.on('challenge_accepted', handleChallengeAccepted);
    client.on('attack_result', handleAttackResultEvent);
    client.on('image_updated', handleImageUpdated);
    client.on('image_failed', handleImageFailed);

    // Start the connection
    client.connect();

    return () => {
      console.log('BattleInterface: Cleaning up SSE connection');
      client.off('challenge_accepted', handleChallengeAccepted);
      client.off('attack_result', handleAttackResultEvent);
      client.off('image_updated', handleImageUpdated);
      client.off('image_failed', handleImageFailed);
      client.disconnect();
    };
  }, [slug]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [battleMessages]);

  const addBattleMessage = (
    message: string,
    type: BattleMessage['type'] = 'info'
  ) => {
    const newMessage: BattleMessage = {
      id: Date.now().toString(),
      message,
      type,
      timestamp: new Date(),
    };

    setBattleMessages((prev: BattleMessage[]) => [
      ...prev.slice(-49),
      newMessage,
    ]); // Keep last 50 messages
  };

  const handleAttackResult = (attackResult: any, newGameState: GameState) => {
    setGameState(newGameState);
    setProcessingAttackId(null);

    // Add battle messages
    const attacker =
      newGameState.player1.id === attackResult.attackerId
        ? newGameState.player1
        : newGameState.player2;
    const defender =
      newGameState.player1.id === attackResult.defenderId
        ? newGameState.player1
        : newGameState.player2;
    const attackerName = getSpeciesName(attacker.species);
    const defenderName = getSpeciesName(defender.species);

    if (attackResult.isHit) {
      let message = `⚔️ ${attackerName} used ${attackResult.attackUsed.name}!`;
      if (attackResult.isCritical) {
        message += ` 💥 Critical hit!`;
      }
      message += ` Dealt ${attackResult.damage} damage to ${defenderName}.`;
      addBattleMessage(message, 'attack');
    } else {
      addBattleMessage(
        `💨 ${attackerName} used ${attackResult.attackUsed.name} but missed!`,
        'miss'
      );
    }

    if (attackResult.gameOver) {
      addBattleMessage(`🏆 ${attackerName} wins the battle!`, 'victory');
      // Victory screen will be shown when gameState.gamePhase === 'finished'
    }
  };

  const handleImageUpdate = (imageUrl: string, turnNumber: number) => {
    console.log('Image ready:', imageUrl, 'for turn:', turnNumber);
    const imageElement = document.getElementById(
      'fight-scene-image'
    ) as HTMLImageElement;
    if (imageElement && imageUrl) {
      imageElement.style.opacity = '0';
      imageElement.src = imageUrl;
      imageElement.onload = () => {
        imageElement.style.transition = 'opacity 0.5s ease';
        imageElement.style.opacity = '1';
      };
    }
  };

  const executeAttack = async (attackId: string) => {
    if (!myCharacter || processingAttackId) return;

    setProcessingAttackId(attackId);

    const attack = myCharacter.attacks.find((a: Attack) => a.id === attackId);
    if (attack) {
      const myName =
        myCharacter.species.charAt(0).toUpperCase() +
        myCharacter.species.slice(1);
      addBattleMessage(`⚡ ${myName} is preparing ${attack.name}...`, 'info');
    }

    try {
      const response = await fetch(`/api/brawls/${slug}/attack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: myCharacter.id,
          attackId,
          browserId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Attack failed');
      }
    } catch (error) {
      console.error('Error executing attack:', error);
      addBattleMessage(
        `❌ Attack failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
      setProcessingAttackId(null);
    }
  };

  const getHealthPercentage = (health: number, maxHealth: number) =>
    Math.max(0, Math.min(100, (health / maxHealth) * 100));

  const getEnergyPercentage = (energy: number, maxEnergy: number) =>
    Math.max(0, Math.min(100, (energy / maxEnergy) * 100));

  if (!gameState || !myCharacter || !enemyCharacter) {
    return (
      <div className="pokemon-window p-4 text-center">
        <div className="text-xs">Loading battle...</div>
      </div>
    );
  }

  return (
    <div
      className="border-4 border-black bg-gradient-to-br from-gray-100 to-gray-200 shadow-lg text-black flex flex-col"
      style={{
        fontFamily: "'Press Start 2P', monospace",
        fontSize: '12px',
        lineHeight: '1.6',
        imageRendering: 'pixelated',
        boxShadow:
          'inset -2px -2px 0px #c0c0c0, inset 2px 2px 0px #ffffff, 4px 4px 0px #808080',
      }}
    >
      {/* Fight Scene Image with Overlays */}
      <div className="relative">
        <div className="relative w-full aspect-[4/3]">
          {currentImageUrl ? (
            <img
              id="fight-scene-image"
              src={currentImageUrl}
              alt="Fight scene"
              className="w-full h-full object-cover pixel-perfect pokemon-window"
            />
          ) : (
            <div className="w-full h-full object-cover pixel-perfect pokemon-window bg-gray-300 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl mb-2">⚡</div>
                <p className="text-black font-bold">Loading Battle...</p>
              </div>
            </div>
          )}

          {/* Enemy Health Info */}
          {gameState.gamePhase !== 'finished' && (
            <div className={`absolute z-10 ${layoutClasses.enemyHealth}`}>
              <div
                className="bg-red-100 border-2 border-black p-4 min-w-48 relative"
                style={{
                  border: '3px solid #f44336',
                  boxShadow:
                    'inset -2px -2px 0px #d32f2f, inset 2px 2px 0px #ef5350, 0 0 10px rgba(244, 67, 54, 0.3), 2px 2px 0px #808080',
                }}
              >
                <div className="absolute -top-2 left-2 bg-red-500 text-white px-2 py-1 text-xs font-bold rounded-sm">
                  ENEMY
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs">
                    {getSpeciesName(enemyCharacter.species).toUpperCase()}
                  </span>
                </div>
                <div
                  className="h-2 bg-white border border-black relative overflow-hidden mb-1"
                  style={{
                    boxShadow: 'inset 1px 1px 2px rgba(0, 0, 0, 0.3)',
                  }}
                >
                  <div
                    className={`h-full transition-all duration-500 ${getHealthPercentage(enemyCharacter.health, enemyCharacter.maxHealth) <= 25 ? 'animate-pulse bg-red-500' : 'bg-gradient-to-r from-green-500 via-yellow-500 to-red-500'}`}
                    style={{
                      width: `${getHealthPercentage(enemyCharacter.health, enemyCharacter.maxHealth)}%`,
                      imageRendering: 'pixelated',
                    }}
                  />
                </div>
                <div className="text-xs">
                  <span>
                    {enemyCharacter.health}/{enemyCharacter.maxHealth}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Player Health Info */}
          {gameState.gamePhase !== 'finished' && (
            <div className={`absolute z-10 ${layoutClasses.playerHealth}`}>
              <div
                className="bg-green-100 border-2 border-black p-4 min-w-48 relative"
                style={{
                  border: '3px solid #4caf50',
                  boxShadow:
                    'inset -2px -2px 0px #388e3c, inset 2px 2px 0px #81c784, 0 0 10px rgba(76, 175, 80, 0.3), 2px 2px 0px #808080',
                }}
              >
                <div className="absolute -top-2 left-2 bg-green-500 text-white px-2 py-1 text-xs font-bold rounded-sm">
                  YOU
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs">
                    {getSpeciesName(myCharacter.species).toUpperCase()}
                  </span>
                </div>
                <div
                  className="h-2 bg-white border border-black relative overflow-hidden mb-1"
                  style={{
                    boxShadow: 'inset 1px 1px 2px rgba(0, 0, 0, 0.3)',
                  }}
                >
                  <div
                    className={`h-full transition-all duration-500 ${getHealthPercentage(myCharacter.health, myCharacter.maxHealth) <= 25 ? 'animate-pulse bg-red-500' : 'bg-gradient-to-r from-green-500 via-yellow-500 to-red-500'}`}
                    style={{
                      width: `${getHealthPercentage(myCharacter.health, myCharacter.maxHealth)}%`,
                      imageRendering: 'pixelated',
                    }}
                  />
                </div>
                <div className="text-xs mb-2">
                  <span>
                    {myCharacter.health}/{myCharacter.maxHealth}
                  </span>
                </div>
                {/* Energy Bar */}
                <div
                  className="h-2 border border-black relative overflow-hidden"
                  style={{
                    background: 'rgba(0, 0, 128, 0.8)',
                    boxShadow: 'inset 1px 1px 2px rgba(0, 0, 0, 0.3)',
                  }}
                >
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${getEnergyPercentage(myCharacter.energy, myCharacter.maxEnergy)}%`,
                      background:
                        'linear-gradient(90deg, #0080ff 0%, #00ffff 100%)',
                      imageRendering: 'pixelated',
                    }}
                  />
                </div>
                <div className="text-xs">
                  <span>
                    {myCharacter.energy}/{myCharacter.maxEnergy} EP
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Turn Indicator */}
          {gameState.gamePhase !== 'finished' && (
            <div className={`absolute z-10 ${layoutClasses.turnIndicator}`}>
              <div
                className="bg-yellow-400 border-2 border-black px-2 py-1 animate-pulse"
                style={{
                  boxShadow: '2px 2px 0px #808080',
                }}
              >
                <span className="text-xs font-bold text-black">
                  TURN {gameState.turnNumber}
                </span>
              </div>
            </div>
          )}

          {/* Current Player Indicator */}
          {gameState.gamePhase !== 'finished' && (
            <div
              className={`absolute z-10 ${layoutClasses.currentPlayerIndicator}`}
            >
              <div
                className="bg-gray-100 border-2 border-black p-2"
                style={{
                  background: 'rgba(248, 248, 248, 0.95)',
                  boxShadow: '2px 2px 0px #808080',
                }}
              >
                <div className="text-xs font-bold">
                  {!isHydrated ? (
                    <span className="text-gray-600">⏳ LOADING...</span>
                  ) : isMyTurn ? (
                    <span className="text-green-600">🎯 YOUR TURN!</span>
                  ) : (
                    <span className="text-red-600">
                      ⏳ {getSpeciesName(enemyCharacter.species).toUpperCase()}
                      'S TURN
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Victory Screen */}
      {gameState.gamePhase === 'finished' && gameState.winner && (
        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 z-50">
          <div
            className="bg-white border-4 border-black px-6 py-4"
            style={{
              fontFamily: "'Press Start 2P', monospace",
              boxShadow:
                'inset -4px -4px 0px #c0c0c0, inset 4px 4px 0px #ffffff, 8px 8px 0px #808080',
            }}
          >
            <div className="text-center">
              <div className="text-lg mb-2">
                🏆{' '}
                {getSpeciesName(
                  gameState.winner === myCharacter.id
                    ? myCharacter.species
                    : enemyCharacter.species
                ).toUpperCase()}{' '}
                WINS! 🏆
              </div>
              <div className="text-xs text-gray-600">
                {gameState.winner === myCharacter.id ? 'VICTORY!' : 'DEFEAT!'} •{' '}
                {gameState.turnNumber} turns
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Victory Buttons - Show at bottom when game finished */}
      {gameState.gamePhase === 'finished' && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="flex space-x-4">
            <button
              className="border-2 border-black p-3 cursor-pointer transition-all duration-150 bg-gradient-to-br from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1"
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '9px',
                boxShadow:
                  'inset -2px -2px 0px #c0c0c0, inset 2px 2px 0px #ffffff, 2px 2px 0px #808080',
              }}
              onClick={() => (window.location.href = '/')}
            >
              🆕 NEW BATTLE
            </button>
            <button
              className="border-2 border-black p-3 cursor-pointer transition-all duration-150 bg-gradient-to-br from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1"
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '9px',
                boxShadow:
                  'inset -2px -2px 0px #c0c0c0, inset 2px 2px 0px #ffffff, 2px 2px 0px #808080',
              }}
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: 'Nature Brawl Victory!',
                    url: window.location.href,
                  });
                } else {
                  navigator.clipboard.writeText(window.location.href);
                }
              }}
            >
              📤 SHARE
            </button>
          </div>
        </div>
      )}

      {/* Battle Controls - Hidden when game is finished */}
      {gameState.gamePhase !== 'finished' && (
        <div className="space-y-4 flex-shrink-0">
          {/* Attack Menu */}
          <div
            className="bg-gray-100 border-4 border-black p-4"
            style={{
              background: '#f8f8f8',
              boxShadow:
                'inset -2px -2px 0px #c0c0c0, inset 2px 2px 0px #ffffff, 4px 4px 0px #808080',
            }}
          >
            <div className="text-xs font-bold mb-4 text-center">
              WHAT WILL {getSpeciesName(myCharacter.species).toUpperCase()} DO?
            </div>

            {isMyTurn && gameState.gamePhase === 'active' ? (
              <div className="grid grid-cols-2 gap-3">
                {myCharacter.attacks.map((attack) => {
                  const canUse = myCharacter.energy >= attack.energyCost;
                  const isProcessing = processingAttackId === attack.id;

                  return (
                    <button
                      key={attack.id}
                      className={`
                        border-2 border-black p-4 cursor-pointer transition-all duration-150 relative overflow-hidden
                        ${
                          !canUse
                            ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-60'
                            : isProcessing
                              ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-black animate-pulse cursor-wait'
                              : 'bg-gradient-to-br from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1'
                        }
                      `}
                      style={{
                        fontFamily: "'Press Start 2P', monospace",
                        fontSize: '9px',
                        boxShadow: !canUse
                          ? 'none'
                          : isProcessing
                            ? 'inset -1px -1px 0px #f59e0b, inset 1px 1px 0px #fbbf24'
                            : 'inset -2px -2px 0px #c0c0c0, inset 2px 2px 0px #ffffff, 2px 2px 0px #808080',
                      }}
                      disabled={!canUse || !!processingAttackId}
                      onClick={() => executeAttack(attack.id)}
                      title={
                        !canUse
                          ? `Not enough energy! Need ${attack.energyCost} EP, have ${myCharacter.energy} EP`
                          : ''
                      }
                    >
                      {isProcessing ? (
                        '⏳ PROCESSING...'
                      ) : (
                        <>
                          <div className="font-bold text-xs mb-2">
                            {attack.name.toUpperCase()}
                          </div>
                          <div className="flex justify-between items-center mt-2 text-xs">
                            <span className="inline-flex items-center gap-1">
                              <span>⚔️</span>
                              <span>{attack.damage}</span>
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span>⚡</span>
                              <span>{attack.energyCost}</span>
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span>✨</span>
                              <span>{attack.criticalHitChance}%</span>
                            </span>
                          </div>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-xs">
                <div
                  className="bg-gray-100 border-2 border-black p-4"
                  style={{
                    background: '#f8f8f8',
                    boxShadow:
                      'inset -1px -1px 0px #c0c0c0, inset 1px 1px 0px #ffffff',
                  }}
                >
                  <div>
                    {isMyTurn
                      ? 'Choose your attack!'
                      : 'Waiting for opponent...'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Battle Log */}
          <div
            className="bg-gray-100 border-4 border-black p-4 my-2"
            style={{
              background: '#f8f8f8',
              boxShadow:
                'inset -2px -2px 0px #c0c0c0, inset 2px 2px 0px #ffffff',
            }}
          >
            <div className="text-xs font-bold mb-2">BATTLE LOG</div>
            <div className="text-xs">
              {battleMessages.map((msg) => {
                const bgColor =
                  {
                    attack: '#ffe0e0',
                    miss: '#f0f0f0',
                    victory: '#e0ffe0',
                    error: '#ffe0e0',
                    warning: '#fff0e0',
                    info: '#e0f0ff',
                  }[msg.type] || '#f0f0f0';

                return (
                  <div
                    key={msg.id}
                    className="my-1 p-1 border-l-2 border-black"
                    style={{
                      background: bgColor,
                    }}
                  >
                    <span className="text-gray-500">
                      [
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      ]
                    </span>{' '}
                    {msg.message}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
