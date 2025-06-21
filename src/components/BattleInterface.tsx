import React, { useState, useEffect, useRef } from 'react';
import { getSpeciesName } from '../lib/species';

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
  winner?: string;
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
  const [battleMessages, setBattleMessages] = useState<BattleMessage[]>([
    {
      id: '1',
      message: '⚔️ Battle begins! Choose your move!',
      type: 'info',
      timestamp: new Date(),
    },
  ]);
  const [processingAttackId, setProcessingAttackId] = useState<string | null>(
    null
  );
  const [isVictoryScreenVisible, setIsVictoryScreenVisible] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
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
  const isMyTurn = gameState?.currentPlayer === myCharacterId;

  // Layout classes based on player position
  const layoutClasses = {
    // Player is always at bottom, enemy at top
    // If I'm player 1: I'm bottom-right, enemy top-left
    // If I'm player 2: I'm bottom-left, enemy top-right
    playerHealth: isPlayer1Me ? 'bottom-4 right-4' : 'bottom-4 left-4',
    enemyHealth: isPlayer1Me ? 'top-4 left-4' : 'top-4 right-4',
    turnIndicator: isPlayer1Me ? 'top-4 right-4' : 'top-4 left-4',
    currentPlayerIndicator: isPlayer1Me
      ? 'bottom-4 left-4'
      : 'bottom-4 right-4',
  };

  // Setup SSE connection
  useEffect(() => {
    if (!slug) return;

    const eventSource = new EventSource(`/api/brawls/${slug}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('SSE Message received:', data);

        switch (data.type) {
          case 'brawl_update':
            if (data.event === 'challenge_accepted') {
              window.location.reload();
            }
            break;
          case 'attack_result':
            handleAttackResult(data.attackResult, data.gameState);
            break;
          case 'image_updated':
            handleImageUpdate(data.imageUrl, data.turnNumber);
            break;
          case 'image_failed':
            console.warn('Image generation failed:', data.error);
            addBattleMessage(
              `⚠️ Image generation failed: ${data.error}`,
              'warning'
            );
            break;
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = (event) => {
      console.error('SSE connection error:', event);
    };

    return () => {
      eventSource.close();
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
    const attackerName =
      attacker.species.charAt(0).toUpperCase() + attacker.species.slice(1);
    const defenderName =
      defender.species.charAt(0).toUpperCase() + defender.species.slice(1);

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
      setIsVictoryScreenVisible(true);
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
      className="border-4 border-black bg-gradient-to-br from-gray-100 to-gray-200 shadow-lg"
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
      <div className="relative mb-4">
        <div className="relative">
          {currentImageUrl ? (
            <img
              id="fight-scene-image"
              src={currentImageUrl}
              alt="Fight scene"
              className="w-full h-80 object-cover pixel-perfect pokemon-window"
            />
          ) : (
            <div className="w-full h-80 pokemon-window bg-gray-300 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl mb-2">⚡</div>
                <p className="text-black font-bold">Loading Battle...</p>
              </div>
            </div>
          )}

          {/* Enemy Health Info */}
          <div className={`absolute z-10 ${layoutClasses.enemyHealth}`}>
            <div
              className="bg-red-100 border-2 border-black p-2 min-w-48 relative"
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

          {/* Player Health Info */}
          <div className={`absolute z-10 ${layoutClasses.playerHealth}`}>
            <div
              className="bg-green-100 border-2 border-black p-2 min-w-48 relative"
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

          {/* Turn Indicator */}
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

          {/* Current Player Indicator */}
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
                {isMyTurn ? (
                  <span className="text-green-600">🎯 YOUR TURN!</span>
                ) : (
                  <span className="text-red-600">
                    ⏳ {getSpeciesName(enemyCharacter.species).toUpperCase()}'S
                    TURN
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Victory Screen */}
      {isVictoryScreenVisible && gameState.winner && (
        <div className="space-y-6">
          <div className="text-center">
            <div
              className="bg-gray-100 border-2 border-black p-6 mb-6"
              style={{
                background: '#f8f8f8',
                boxShadow:
                  'inset -1px -1px 0px #c0c0c0, inset 1px 1px 0px #ffffff',
              }}
            >
              <div className="text-lg font-bold mb-4">
                🏆{' '}
                {gameState.winner === myCharacter.id ? 'YOU WIN!' : 'YOU LOSE!'}{' '}
                🏆
              </div>
              <div className="text-xs mb-4">
                Battle completed in {gameState.turnNumber} turns!
              </div>
            </div>
            <div className="space-y-3">
              <button
                className="w-full border-2 border-black p-4 cursor-pointer transition-all duration-150 bg-gradient-to-br from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1"
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
                className="w-full border-2 border-black p-4 cursor-pointer transition-all duration-150 bg-gradient-to-br from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1"
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
                📤 SHARE BATTLE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Battle Controls */}
      {!isVictoryScreenVisible && (
        <div className="space-y-4">
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
            className="bg-gray-100 border-4 border-black p-4 my-2 min-h-20"
            style={{
              background: '#f8f8f8',
              boxShadow:
                'inset -2px -2px 0px #c0c0c0, inset 2px 2px 0px #ffffff',
              maxHeight: '120px',
            }}
          >
            <div className="text-xs font-bold mb-2">BATTLE LOG</div>
            <div className="text-xs max-h-48 overflow-y-auto">
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
