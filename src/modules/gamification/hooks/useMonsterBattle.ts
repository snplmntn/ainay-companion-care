import { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import type { MonsterStage, MonsterBattleState, DamageNumberProps } from '../types';
import { ANIMATION_DURATIONS, HP_PER_MEDICATION } from '../constants';

interface UseMonsterBattleProps {
  totalMeds: number;
  completedMeds: number;
}

interface UseMonsterBattleReturn extends MonsterBattleState {
  triggerHit: (damage?: number) => void;
  triggerVictory: () => void;
  removeDamageNumber: (id: string) => void;
}

const getStageFromProgress = (progress: number): MonsterStage => {
  if (progress >= 100) return 'victory';
  if (progress > 30) return 'battle';
  return 'threat';
};

export const useMonsterBattle = ({
  totalMeds,
  completedMeds,
}: UseMonsterBattleProps): UseMonsterBattleReturn => {
  const prevCompletedRef = useRef(completedMeds);
  const hasTriggeredVictoryRef = useRef(false);

  const maxHP = totalMeds * HP_PER_MEDICATION;
  const progress = totalMeds > 0 ? (completedMeds / totalMeds) * 100 : 0;
  const currentHP = Math.max(0, maxHP - completedMeds * HP_PER_MEDICATION);
  const stage = getStageFromProgress(progress);

  const [isHit, setIsHit] = useState(false);
  const [isVictory, setIsVictory] = useState(false);
  const [damageNumbers, setDamageNumbers] = useState<DamageNumberProps[]>([]);

  const triggerHit = useCallback((damage: number = HP_PER_MEDICATION) => {
    setIsHit(true);

    // Add floating damage number at random position
    const newDamage: DamageNumberProps = {
      id: `damage-${Date.now()}-${Math.random()}`,
      damage,
      x: 40 + Math.random() * 20, // 40-60% from left
      y: 30 + Math.random() * 20, // 30-50% from top
    };

    setDamageNumbers((prev) => [...prev, newDamage]);

    // Reset hit state after animation
    setTimeout(() => {
      setIsHit(false);
    }, ANIMATION_DURATIONS.hit);

    // Remove damage number after float animation
    setTimeout(() => {
      setDamageNumbers((prev) => prev.filter((d) => d.id !== newDamage.id));
    }, ANIMATION_DURATIONS.damageFloat);
  }, []);

  const triggerVictory = useCallback(() => {
    setIsVictory(true);

    // Fire confetti!
    const duration = ANIMATION_DURATIONS.confetti;
    const animationEnd = Date.now() + duration;

    const randomInRange = (min: number, max: number) => 
      Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = 50 * (timeLeft / duration);

      // Confetti from both sides
      confetti({
        particleCount: Math.floor(particleCount),
        startVelocity: 30,
        spread: 360,
        origin: {
          x: randomInRange(0.1, 0.3),
          y: randomInRange(0.2, 0.5),
        },
        colors: ['#22c55e', '#10b981', '#34d399', '#6ee7b7', '#fbbf24'],
      });

      confetti({
        particleCount: Math.floor(particleCount),
        startVelocity: 30,
        spread: 360,
        origin: {
          x: randomInRange(0.7, 0.9),
          y: randomInRange(0.2, 0.5),
        },
        colors: ['#22c55e', '#10b981', '#34d399', '#6ee7b7', '#fbbf24'],
      });
    }, 250);

    setTimeout(() => {
      setIsVictory(false);
    }, ANIMATION_DURATIONS.victory);
  }, []);

  const removeDamageNumber = useCallback((id: string) => {
    setDamageNumbers((prev) => prev.filter((d) => d.id !== id));
  }, []);

  // Watch for medication completions
  useEffect(() => {
    const prevCompleted = prevCompletedRef.current;

    if (completedMeds > prevCompleted) {
      // Medication was just taken
      const medsTaken = completedMeds - prevCompleted;
      triggerHit(medsTaken * HP_PER_MEDICATION);
    }

    prevCompletedRef.current = completedMeds;
  }, [completedMeds, triggerHit]);

  // Watch for victory condition
  useEffect(() => {
    if (progress >= 100 && !hasTriggeredVictoryRef.current && totalMeds > 0) {
      hasTriggeredVictoryRef.current = true;
      triggerVictory();
    }

    // Reset victory flag if progress drops below 100
    if (progress < 100) {
      hasTriggeredVictoryRef.current = false;
    }
  }, [progress, totalMeds, triggerVictory]);

  return {
    currentHP,
    maxHP,
    stage,
    progress,
    isHit,
    isVictory,
    damageNumbers,
    triggerHit,
    triggerVictory,
    removeDamageNumber,
  };
};


