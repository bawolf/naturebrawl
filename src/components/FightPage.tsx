import React, { useState, useEffect, useRef } from 'react';
import BattleInterface from './BattleInterface';
import { SSEClient } from '../lib/sse-client';
import type { Brawl, Character } from '../lib/game/engine';
import { SPECIES, getSpeciesEmoji, getSpeciesName } from '../lib/species';
import SpeciesSelectionTile from './SpeciesSelectionTile';

// Custom hook for browser ID management
const useBrowserId = () => {
  const [browserId, setBrowserId] = useState<string>('');

  useEffect(() => {
    let id = localStorage.getItem('naturebrawl.browserId');
    if (!id) {
      id = 'browser_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('naturebrawl.browserId', id);
    }
    setBrowserId(id);
  }, []);

  return browserId;
};

// Custom hook for character ID determination
const useMyCharacter = (brawl: Brawl, browserId: string) => {
  return brawl.characters.find((char) => char.browserId === browserId) || null;
};

// This is a UI-specific version of GameState, which might differ slightly
// from the engine's internal state representation. For now, they are similar.
type GameState = {
  player1: Character;
  player2: Character;
  currentPlayer: string;
  gamePhase: 'waiting' | 'active' | 'finished';
  turnNumber: number;
  winner: string | null;
  brawl: Brawl;
};

interface FightPageProps {
  slug: string;
  initialIsWaiting: boolean;
  brawl: Brawl;
  browserId: string;
}

const FightPage: React.FC<FightPageProps> = ({
  slug,
  initialIsWaiting,
  brawl,
  browserId,
}) => {
  const [isWaiting, setIsWaiting] = useState(initialIsWaiting);
  const [currentBrawl, setCurrentBrawl] = useState(brawl);
  const [sseClient, setSseClient] = useState<SSEClient | null>(null);

  // Use centralized browser ID management
  const actualBrowserId = useBrowserId();
  const myCharacter = useMyCharacter(currentBrawl, actualBrowserId);

  // Single SSE connection for the entire fight lifecycle
  useEffect(() => {
    console.log('FightPage: Setting up SSE connection for fight:', slug);

    const client = new SSEClient(slug);
    setSseClient(client);

    // Set up event listeners
    const handleConnection = (data: any) => {
      console.log('Fight connection status changed:', data);
    };

    const handleChallengeAccepted = (data: any) => {
      console.log('Challenge accepted! Transitioning to battle state...');

      // Update the brawl state with the new characters
      if (data.challenger && data.challengee) {
        setCurrentBrawl((prevBrawl) => {
          const updatedBrawl = {
            ...prevBrawl,
            characters: [data.challenger, data.challengee],
            currentPlayerId: data.challenger.id, // Ensure challenger goes first
          };

          console.log('FightPage: Challenge accepted - characters updated');

          return updatedBrawl;
        });
      }

      setIsWaiting(false);
      // No page reload needed - just update state
    };

    client.on('connection', handleConnection);
    client.on('challenge_accepted', handleChallengeAccepted);

    // Start the connection
    client.connect();

    // Cleanup on unmount only
    return () => {
      console.log('FightPage: Cleaning up SSE connection');
      client.off('connection', handleConnection);
      client.off('challenge_accepted', handleChallengeAccepted);
      client.disconnect();
      setSseClient(null);
    };
  }, [slug]); // Only depend on slug, not isWaiting

  if (isWaiting) {
    const isChallenger = myCharacter?.id === currentBrawl.characters[0]?.id;

    return (
      <Lobby
        slug={slug}
        challenger={currentBrawl.characters[0]}
        isCurrentUserChallenger={isChallenger}
      />
    );
  }

  // This check ensures we don't proceed to the BattleInterface without a full brawl
  if (currentBrawl.characters.length < 2) {
    return <div>Waiting for opponent to load...</div>;
  }

  const initialGameState: GameState = {
    player1: currentBrawl.characters[0],
    player2: currentBrawl.characters[1],
    currentPlayer:
      currentBrawl.currentPlayerId || currentBrawl.characters[0].id,
    gamePhase: currentBrawl.winnerId ? 'finished' : 'active',
    turnNumber: currentBrawl.turnNumber || 1,
    winner: currentBrawl.winnerId || null,
    brawl: currentBrawl,
  };

  return (
    <BattleInterface
      slug={slug}
      initialGameState={initialGameState}
      myCharacterId={myCharacter?.id || ''}
      browserId={actualBrowserId}
      currentImageUrl={currentBrawl.currentImageUrl || undefined}
      sseClient={sseClient}
    />
  );
};

// Lobby component for waiting state
interface LobbyProps {
  slug: string;
  challenger: Character;
  isCurrentUserChallenger: boolean;
}

const Lobby: React.FC<LobbyProps> = ({
  slug,
  challenger,
  isCurrentUserChallenger,
}) => {
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareableLink, setShareableLink] = useState('');
  const linkInputRef = useRef<HTMLInputElement>(null);

  const menuButtonClasses = `
    bg-gradient-to-br from-gray-100 to-gray-200 
    border-2 border-black 
    text-[11px] px-4 py-2
    cursor-pointer 
    transition-all duration-150 ease-in-out 
    shadow-[inset_-2px_-2px_0px_#c0c0c0,inset_2px_2px_0px_#ffffff,2px_2px_0px_#808080] 
    text-black relative 
    hover:not(:disabled):bg-gradient-to-br hover:not(:disabled):from-gray-200 hover:not(:disabled):to-gray-300 
    hover:not(:disabled):translate-x-px hover:not(:disabled):translate-y-px 
    hover:not(:disabled):shadow-[inset_-1px_-1px_0px_#a0a0a0,inset_1px_1px_0px_#ffffff,1px_1px_0px_#808080] 
    active:not(:disabled):translate-x-[2px] active:not(:disabled):translate-y-[2px] 
    active:not(:disabled):shadow-[inset_-1px_-1px_0px_#808080,inset_1px_1px_0px_#f0f0f0] 
    focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  useEffect(() => {
    // This code only runs on the client, where window is available
    setShareableLink(window.location.href);
  }, []);

  const handleCopyLink = async () => {
    if (!shareableLink) {
      console.warn('Attempted to copy an empty link.');
      return;
    }

    // Modern async clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(shareableLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return; // Success
      } catch (err) {
        console.error('Failed to copy using modern clipboard API:', err);
        // Fall through to legacy method
      }
    }

    // Fallback for older browsers or insecure contexts
    if (linkInputRef.current) {
      try {
        linkInputRef.current.select();
        const successful = document.execCommand('copy');
        if (successful) {
          // Deselect the text
          window.getSelection()?.removeAllRanges();
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } else {
          throw new Error('Copy command failed');
        }
      } catch (err) {
        console.error('Failed to copy using fallback method:', err);
        alert(
          'Could not copy the link automatically. Please copy it manually.'
        );
      }
    }
  };

  const handleAcceptChallenge = async () => {
    if (!selectedSpecies) return;
    setIsJoining(true);

    try {
      const response = await fetch(`/api/brawls/${slug}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          species: selectedSpecies,
          browserId: localStorage.getItem('naturebrawl.browserId'),
        }),
      });

      if (response.ok) {
        window.location.reload();
      } else {
        const error = await response.json();
        alert(`Failed to join battle: ${error.error}`);
        setIsJoining(false);
      }
    } catch (error) {
      console.error('Error joining battle:', error);
      alert('Failed to join battle. Please try again.');
      setIsJoining(false);
    }
  };

  return (
    <div className="text-center text-black">
      <div className="p-6 mb-6 bg-[#f8f8f8] border-2 border-black shadow-[inset_-1px_-1px_0px_#c0c0c0,inset_1px_1px_0px_#ffffff]">
        <h2 className="text-lg font-bold text-black mb-6">
          🎯 CHALLENGE CREATED!
        </h2>
        <div className="flex justify-center items-center mb-6 flex-wrap gap-4">
          {/* Challenger card */}
          <div className="p-4 text-center bg-gradient-to-br from-[#f8f8f8] to-[#e8e8e8] border-2 border-black shadow-[inset_-1px_-1px_0px_#c0c0c0,inset_1px_1px_0px_#ffffff,2px_2px_0px_#808080] transition-all duration-150">
            <div className="text-4xl mb-2">
              {getSpeciesEmoji(challenger.species)}
            </div>
            <h3 className="text-xs font-bold text-black">
              {getSpeciesName(challenger.species)}
            </h3>
            <p className="text-xs text-gray-600">CHALLENGER</p>
          </div>
          <div
            className="mx-4 text-2xl text-black"
            style={{
              textShadow:
                '1px 1px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000',
            }}
          >
            VS
          </div>
          {/* Opponent card */}
          <div className="p-4 text-center bg-gray-200 border-2 border-black shadow-[inset_-1px_-1px_0px_#c0c0c0,inset_1px_1px_0px_#ffffff,2px_2px_0px_#808080] transition-all duration-150">
            <div className="text-4xl mb-2">❓</div>
            <h3 className="text-xs font-bold text-black">WAITING</h3>
            <p className="text-xs text-gray-600">OPPONENT</p>
          </div>
        </div>

        {/* Share link section */}
        <div className="mb-6">
          <p className="text-sm text-black mb-3">
            🔗 Share this link to invite an opponent:
          </p>
          <div className="flex items-center gap-2 justify-center flex-wrap">
            <input
              ref={linkInputRef}
              type="text"
              value={shareableLink}
              readOnly
              className="px-3 py-2 border-2 border-black bg-white text-black text-xs font-mono max-w-xs truncate"
            />
            <button
              onClick={handleCopyLink}
              className={`${menuButtonClasses} ${copied ? 'bg-green-200' : ''}`}
            >
              {copied ? '✓ COPIED!' : '📋 COPY'}
            </button>
          </div>
        </div>

        {/* Accept challenge section */}
        {!isCurrentUserChallenger && (
          <div>
            <p className="text-sm text-black mb-4">
              🥊 Ready to accept the challenge? Choose your fighter:
            </p>
            <div className="flex flex-wrap gap-3 mb-6 justify-center">
              {SPECIES.map((species) => {
                const isDisabled = species.id === challenger.species;
                return (
                  <SpeciesSelectionTile
                    key={species.id}
                    species={species}
                    isDisabled={isDisabled}
                    isSelected={selectedSpecies === species.id}
                    onSelect={() => setSelectedSpecies(species.id)}
                  />
                );
              })}
            </div>
            <button
              onClick={handleAcceptChallenge}
              disabled={!selectedSpecies || isJoining}
              className={`${menuButtonClasses} ${
                !selectedSpecies || isJoining
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
            >
              {isJoining ? '⏳ JOINING...' : '⚔️ ACCEPT CHALLENGE'}
            </button>
          </div>
        )}

        {isCurrentUserChallenger && (
          <p className="text-sm text-gray-600">
            ⏳ Waiting for an opponent to accept your challenge...
          </p>
        )}
      </div>
    </div>
  );
};

export default FightPage;
