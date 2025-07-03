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
  {
    id: 'eagle',
    name: 'Eagle',
    emoji: '🦅',
    description: 'Aerial hunter with razor-sharp talon strikes',
    gradient: 'from-blue-500 to-gray-700',
    hoverGradient: 'hover:from-blue-600 hover:to-gray-800',
  },
  {
    id: 'shark',
    name: 'Shark',
    emoji: '🦈',
    description: 'Ocean predator with devastating bite force',
    gradient: 'from-blue-600 to-gray-800',
    hoverGradient: 'hover:from-blue-700 hover:to-gray-900',
  },
  {
    id: 'wolf',
    name: 'Wolf',
    emoji: '🐺',
    description: 'Pack hunter with howling intimidation tactics',
    gradient: 'from-gray-500 to-slate-700',
    hoverGradient: 'hover:from-gray-600 hover:to-slate-800',
  },
  {
    id: 'elephant',
    name: 'Elephant',
    emoji: '🐘',
    description: 'Colossal strength with trunk-based attacks',
    gradient: 'from-gray-400 to-slate-600',
    hoverGradient: 'hover:from-gray-500 hover:to-slate-700',
  },
  {
    id: 'snake',
    name: 'Snake',
    emoji: '🐍',
    description: 'Venomous striker with coiling constriction',
    gradient: 'from-green-500 to-emerald-800',
    hoverGradient: 'hover:from-green-600 hover:to-emerald-900',
  },
  {
    id: 'gorilla',
    name: 'Gorilla',
    emoji: '🦍',
    description: 'Brute force specialist with chest-pounding rage',
    gradient: 'from-gray-800 to-black',
    hoverGradient: 'hover:from-gray-900 hover:to-gray-900',
  },
  {
    id: 'crocodile',
    name: 'Crocodile',
    emoji: '🐊',
    description: 'Armored predator with death roll attacks',
    gradient: 'from-green-600 to-green-900',
    hoverGradient: 'hover:from-green-700 hover:to-green-800',
  },
  {
    id: 'rhino',
    name: 'Rhino',
    emoji: '🦏',
    description: 'Charging tank with unstoppable horn strikes',
    gradient: 'from-stone-500 to-gray-700',
    hoverGradient: 'hover:from-stone-600 hover:to-gray-800',
  },
  {
    id: 'octopus',
    name: 'Octopus',
    emoji: '🐙',
    description: 'Tentacled master with ink cloud escapes',
    gradient: 'from-purple-500 to-indigo-700',
    hoverGradient: 'hover:from-purple-600 hover:to-indigo-800',
  },
  {
    id: 'scorpion',
    name: 'Scorpion',
    emoji: '🦂',
    description: 'Venomous assassin with stinger precision',
    gradient: 'from-red-600 to-orange-800',
    hoverGradient: 'hover:from-red-700 hover:to-orange-900',
  },
  {
    id: 'cheetah',
    name: 'Cheetah',
    emoji: '🐆',
    description: 'Speed demon with lightning-quick combos',
    gradient: 'from-yellow-500 to-amber-700',
    hoverGradient: 'hover:from-yellow-600 hover:to-amber-800',
  },
  {
    id: 'hippo',
    name: 'Hippo',
    emoji: '🦛',
    description: 'Territorial crusher with massive jaw power',
    gradient: 'from-pink-400 to-purple-600',
    hoverGradient: 'hover:from-pink-500 hover:to-purple-700',
  },
  {
    id: 'moose',
    name: 'Moose',
    emoji: '🫎',
    description: 'Antlered giant with charging antler strikes',
    gradient: 'from-amber-600 to-brown-800',
    hoverGradient: 'hover:from-amber-700 hover:to-brown-900',
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
