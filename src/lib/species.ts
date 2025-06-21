export interface Species {
  id: string;
  name: string;
  emoji: string;
  description: string;
  gradient: string;
  hoverGradient: string;
}

export const SPECIES: Species[] = [
  {
    id: 'lion',
    name: 'Lion',
    emoji: '🦁',
    description: 'King of the jungle with powerful roar attacks',
    gradient: 'from-yellow-400 to-orange-600',
    hoverGradient: 'hover:from-yellow-500 hover:to-orange-700',
  },
  {
    id: 'tiger',
    name: 'Tiger',
    emoji: '🐅',
    description: 'Swift predator with lightning-fast strikes',
    gradient: 'from-orange-500 to-red-600',
    hoverGradient: 'hover:from-orange-600 hover:to-red-700',
  },
  {
    id: 'bear',
    name: 'Bear',
    emoji: '🐻',
    description: 'Mighty defender with crushing bear hugs',
    gradient: 'from-amber-700 to-orange-900',
    hoverGradient: 'hover:from-amber-800 hover:to-orange-800',
  },
];

export const getSpeciesById = (id: string): Species | undefined => {
  return SPECIES.find((species) => species.id === id);
};

export const getSpeciesEmoji = (id: string): string => {
  const species = getSpeciesById(id);
  return species?.emoji || '❓';
};

export const getSpeciesName = (id: string): string => {
  const species = getSpeciesById(id);
  return species?.name || 'Unknown';
};

export const isValidSpecies = (id: string): boolean => {
  return SPECIES.some((species) => species.id === id);
};
