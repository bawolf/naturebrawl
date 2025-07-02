import React, { useState, useEffect, useRef } from 'react';
import BattleInterface from './BattleInterface';
import { SSEClient } from '../lib/sse-client';
import type {
  GameState as EngineGameState,
  Brawl,
  Character,
  Attack,
} from '../lib/game/engine';
import { SPECIES, getSpeciesEmoji, getSpeciesName } from '../lib/species';

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

  useEffect(() => {
    if (!isWaiting) return;

    console.log('FightPage: Setting up SSE connection for fight:', slug);

    const client = new SSEClient(slug);

    // Set up event listeners
    const handleConnection = (data: any) => {
      console.log('Connection status changed:', data);
    };

    const handleChallengeAccepted = (data: any) => {
      console.log('Challenge accepted event received! Reloading page...');
      window.location.reload();
    };

    client.on('connection', handleConnection);
    client.on('challenge_accepted', handleChallengeAccepted);

    // Start the connection
    client.connect();

    // Cleanup on unmount
    return () => {
      console.log('FightPage: Cleaning up SSE connection');
      client.off('connection', handleConnection);
      client.off('challenge_accepted', handleChallengeAccepted);
      client.disconnect();
    };
  }, [slug, isWaiting]);

  if (isWaiting) {
    const isChallenger = brawl.characters[0]?.browserId === browserId;
    return (
      <Lobby
        slug={slug}
        challenger={brawl.characters[0]}
        isCurrentUserChallenger={isChallenger}
      />
    );
  }

  // This check ensures we don't proceed to the BattleInterface without a full brawl
  if (brawl.characters.length < 2) {
    return <div>Waiting for opponent to load...</div>;
  }

  const initialGameState: GameState = {
    player1: brawl.characters[0],
    player2: brawl.characters[1],
    currentPlayer: brawl.currentPlayerId || brawl.characters[0].id,
    gamePhase: brawl.winnerId ? 'finished' : 'active',
    turnNumber: brawl.turnNumber || 1,
    winner: brawl.winnerId || null,
    brawl: brawl,
  };

  return (
    <BattleInterface
      slug={slug}
      initialGameState={initialGameState}
      myCharacterId="BROWSER_DETERMINED"
      browserId="BROWSER_DETERMINED"
      currentImageUrl={brawl.currentImageUrl || undefined}
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
        document.execCommand('copy');
        // Deselect the text
        window.getSelection()?.removeAllRanges();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-6">
              {SPECIES.map((species) => (
                <button
                  key={species.id}
                  onClick={() => setSelectedSpecies(species.id)}
                  className={`p-3 text-center border-2 border-black transition-all duration-150 ${
                    selectedSpecies === species.id
                      ? 'bg-blue-200 shadow-[inset_-1px_-1px_0px_#808080,inset_1px_1px_0px_#f0f0f0]'
                      : 'bg-gradient-to-br from-[#f8f8f8] to-[#e8e8e8] shadow-[inset_-1px_-1px_0px_#c0c0c0,inset_1px_1px_0px_#ffffff,2px_2px_0px_#808080] hover:bg-gradient-to-br hover:from-gray-200 hover:to-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{species.emoji}</div>
                  <div className="text-xs font-bold text-black">
                    {species.name}
                  </div>
                </button>
              ))}
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
