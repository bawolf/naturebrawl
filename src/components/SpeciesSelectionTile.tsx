import React from 'react';
import type { Species } from '../lib/species';

interface SpeciesSelectionTileProps {
  species: Species;
  isDisabled?: boolean;
  isSelected?: boolean;
  onSelect: () => void;
}

const SpeciesSelectionTile: React.FC<SpeciesSelectionTileProps> = ({
  species,
  isDisabled = false,
  isSelected = false,
  onSelect,
}) => {
  return (
    <button
      onClick={() => !isDisabled && onSelect()}
      disabled={isDisabled}
      className={`p-3 text-center border-2 border-black transition-all duration-150 ${
        isDisabled
          ? 'bg-gray-300 opacity-50 cursor-not-allowed shadow-[inset_-1px_-1px_0px_#a0a0a0,inset_1px_1px_0px_#ffffff]'
          : isSelected
            ? 'bg-blue-200 shadow-[inset_-1px_-1px_0px_#808080,inset_1px_1px_0px_#f0f0f0]'
            : 'bg-gradient-to-br from-[#f8f8f8] to-[#e8e8e8] shadow-[inset_-1px_-1px_0px_#c0c0c0,inset_1px_1px_0px_#ffffff,2px_2px_0px_#808080] hover:bg-gradient-to-br hover:from-gray-200 hover:to-gray-300'
      }`}
    >
      <div className="text-2xl mb-1">{species.emoji}</div>
      <div className="text-xs font-bold text-black">{species.name}</div>
      {isDisabled && <div className="text-xs text-gray-600 mt-1">TAKEN</div>}
    </button>
  );
};

export default SpeciesSelectionTile;
