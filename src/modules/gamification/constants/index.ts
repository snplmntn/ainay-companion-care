import type { MonsterConfig, MonsterStage } from '../types';

export const MONSTER_CONFIGS: Record<MonsterStage, MonsterConfig> = {
  threat: {
    stage: 'threat',
    name: 'Illness Beast',
    emoji: '👹',
    description: 'A fearsome creature threatens your health!',
    color: '#dc2626', // red-600
    bgGradient: 'from-red-900/30 via-red-800/20 to-orange-900/30',
  },
  battle: {
    stage: 'battle',
    name: 'Weakened Beast',
    emoji: '😰',
    description: 'The monster is getting tired... keep fighting!',
    color: '#f97316', // orange-500
    bgGradient: 'from-orange-900/30 via-yellow-800/20 to-amber-900/30',
  },
  victory: {
    stage: 'victory',
    name: 'Defeated!',
    emoji: '😵',
    description: 'Victory! The monster has been vanquished!',
    color: '#22c55e', // green-500
    bgGradient: 'from-green-900/30 via-emerald-800/20 to-teal-900/30',
  },
};

export const HP_PER_MEDICATION = 25; // Each med deals 25 damage

export const ANIMATION_DURATIONS = {
  hit: 500,
  damageFloat: 1500,
  victory: 2000,
  confetti: 3000,
};

export const STREAK_MESSAGES: Record<number, string> = {
  1: 'First day! Great start! 🌟',
  3: 'On a roll! 🔥',
  5: 'Health warrior! 💪',
  7: 'One week champion! 👑',
  14: 'Two week legend! 🏆',
  30: 'Monthly master! 🌙',
};

export const getStreakMessage = (streak: number): string => {
  const thresholds = Object.keys(STREAK_MESSAGES)
    .map(Number)
    .sort((a, b) => b - a);
  
  for (const threshold of thresholds) {
    if (streak >= threshold) {
      return STREAK_MESSAGES[threshold];
    }
  }
  
  return `${streak} Day Streak!`;
};

