import React, { useState, useEffect } from 'react';
import { SPECIES } from '../lib/species';
import SpeciesCard from './SpeciesCard'; // Assuming SpeciesCard is converted to React or we'll adapt

const HomePage: React.FC = () => {
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [battleHistory, setBattleHistory] = useState<string[]>([]);

  const menuButtonClasses = `
    bg-gradient-to-br from-gray-100 to-gray-200 
    border-2 border-black 
    text-[11px] px-6 py-4 
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
    // Load battle history from localStorage on initial render
    const history = JSON.parse(
      localStorage.getItem('naturebrawl.history') || '[]'
    );
    setBattleHistory(history);
  }, []);

  const handleCreateChallenge = async () => {
    if (!selectedSpecies) return;

    setIsCreating(true);

    try {
      // Get or create browser ID
      let browserId = localStorage.getItem('naturebrawl.browserId');
      if (!browserId) {
        browserId = crypto.randomUUID();
        localStorage.setItem('naturebrawl.browserId', browserId);
      }

      const response = await fetch('/api/brawls/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          species: selectedSpecies,
          browserId,
        }),
      });

      if (response.ok) {
        const { slug } = await response.json();

        // Store fight history
        const newHistory = [slug, ...battleHistory].slice(0, 10);
        localStorage.setItem('naturebrawl.history', JSON.stringify(newHistory));
        setBattleHistory(newHistory);

        // Redirect to the challenge page
        window.location.href = `/fight/${slug}`;
      } else {
        throw new Error('Failed to create challenge');
      }
    } catch (error) {
      console.error('Error creating challenge:', error);
      alert('Failed to create challenge. Please try again.');
      setIsCreating(false);
    }
  };

  return (
    <div className="text-black">
      {/* Character Selection */}
      <div className="pokemon-window p-6 mb-6">
        <h2 className="text-lg font-bold text-black text-center mb-6">
          CHOOSE YOUR FIGHTER
        </h2>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-6">
          {SPECIES.map((species) => (
            <SpeciesCard
              key={species.id}
              species={species}
              isSelected={selectedSpecies === species.id}
              onSelect={() => setSelectedSpecies(species.id)}
            />
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={handleCreateChallenge}
            className={menuButtonClasses}
            disabled={!selectedSpecies || isCreating}
          >
            {isCreating ? '⏳ CREATING...' : '🎯 CREATE CHALLENGE'}
          </button>
          <p className="text-xs text-black mt-4">
            Select a fighter to create your challenge
          </p>
        </div>
      </div>

      {/* Battle History */}
      {showHistory && (
        <div className="pokemon-window p-6 mb-6">
          <h3 className="text-sm font-bold text-black mb-4">RECENT BATTLES</h3>
          <div className="space-y-2">
            {battleHistory.length > 0 ? (
              battleHistory.map((slug) => (
                <div
                  key={slug}
                  className="p-3 bg-gray-100 border-2 border-black cursor-pointer hover:bg-gray-200"
                  onClick={() => (window.location.href = `/fight/${slug}`)}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-black">
                      Battle: {slug.toUpperCase()}
                    </span>
                    <span className="text-xs text-black">➤</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-600">
                No battles yet. Create your first challenge!
              </p>
            )}
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRules && (
        <div className="pokemon-window p-6 mb-6">
          <h3 className="text-sm font-bold text-black mb-4">HOW TO PLAY</h3>
          <div className="text-xs text-black space-y-2">
            <p>• Choose your fighter and create a challenge</p>
            <p>• Share the link with a friend to accept your challenge</p>
            <p>• Take turns selecting attacks to defeat your opponent</p>
            <p>• Each attack costs energy - manage it wisely!</p>
            <p>• First to reduce opponent's health to 0 wins!</p>
            <p>• Watch epic AI-generated battle scenes unfold!</p>
          </div>
          <div className="text-center mt-4">
            <button
              onClick={() => setShowRules(false)}
              className={menuButtonClasses}
            >
              ✖ CLOSE
            </button>
          </div>
        </div>
      )}

      {/* Menu Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={menuButtonClasses}
        >
          {showHistory ? '📜 HIDE HISTORY' : '📜 BATTLE HISTORY'}
        </button>
        <button
          onClick={() => setShowRules(!showRules)}
          className={menuButtonClasses}
        >
          {showRules ? '📖 HIDE RULES' : '📖 HOW TO PLAY'}
        </button>
      </div>
    </div>
  );
};

export default HomePage;
