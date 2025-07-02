import React from 'react';

// Assuming Species type is exported from here
import type { Species } from '../lib/species';

interface SpeciesCardProps {
  species: Species;
  size?: 'small' | 'large';
  disabled?: boolean;
  isSelected?: boolean;
  onSelect: () => void;
}

const SpeciesCard: React.FC<SpeciesCardProps> = ({
  species,
  size = 'large',
  disabled = false,
  isSelected = false,
  onSelect,
}) => {
  const sizeClasses = size === 'small' ? 'p-4 text-center' : 'p-6 text-center';
  const emojiSize = size === 'small' ? 'text-4xl' : 'text-6xl';
  const titleSize = size === 'small' ? 'text-lg' : 'text-2xl';
  const descriptionSize = size === 'small' ? 'text-xs' : 'text-sm';

  const baseClasses = `
    bg-gradient-to-b ${species.gradient} 
    rounded-xl ${sizeClasses} 
    cursor-pointer 
    transform 
    transition-all 
    hover:scale-105 
    hover:shadow-xl
    ${species.hoverGradient}
  `;

  const disabledClasses = disabled
    ? 'opacity-50 cursor-not-allowed hover:scale-100'
    : '';

  const selectedClasses = isSelected ? 'ring-4 ring-white ring-opacity-80' : '';

  return (
    <div
      className={`${baseClasses} ${disabledClasses} ${selectedClasses}`}
      onClick={() => !disabled && onSelect()}
    >
      <div className={`${emojiSize} mb-2`}>{species.emoji}</div>
      <h3 className={`${titleSize} font-bold text-white mb-2`}>
        {species.name}
      </h3>
      {!disabled ? (
        <p className={`text-amber-100 ${descriptionSize}`}>
          {species.description}
        </p>
      ) : (
        <p className={`text-gray-300 ${descriptionSize}`}>Already chosen</p>
      )}
    </div>
  );
};

export default SpeciesCard;
