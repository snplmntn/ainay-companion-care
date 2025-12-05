import { Flame, Zap, Heart, Swords, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { useMonsterBattle } from '../hooks/useMonsterBattle';
import { MONSTER_CONFIGS, getStreakMessage } from '../constants';
import type { HealthMonsterWidgetProps, DamageNumberProps } from '../types';

// Floating damage number component
const DamageNumber = ({ damage, x, y }: Omit<DamageNumberProps, 'id'>) => (
  <div
    className="absolute pointer-events-none animate-damage-float z-20"
    style={{
      left: `${x}%`,
      top: `${y}%`,
      transform: 'translateX(-50%)',
    }}
  >
    <span className="text-2xl md:text-3xl font-black text-red-500 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
      -{damage} HP
    </span>
  </div>
);

// Monster sprite component based on stage
const MonsterSprite = ({
  stage,
  isHit,
  isVictory,
}: {
  stage: 'threat' | 'battle' | 'victory';
  isHit: boolean;
  isVictory: boolean;
}) => {
  const config = MONSTER_CONFIGS[stage];

  return (
    <div
      className={cn(
        'relative flex items-center justify-center transition-all duration-300',
        isHit && 'animate-monster-hit',
        isVictory && 'animate-monster-victory'
      )}
    >
      {/* Monster container with glow effect */}
      <div
        className={cn(
          'relative rounded-full p-4 md:p-6 transition-all duration-500',
          stage === 'threat' && 'bg-gradient-to-br from-red-500/20 to-orange-500/20 shadow-[0_0_40px_rgba(239,68,68,0.4)]',
          stage === 'battle' && 'bg-gradient-to-br from-orange-500/20 to-yellow-500/20 shadow-[0_0_30px_rgba(249,115,22,0.3)]',
          stage === 'victory' && 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 shadow-[0_0_30px_rgba(34,197,94,0.4)]',
          isHit && 'bg-red-500/40'
        )}
      >
        {/* Monster emoji */}
        <span
          className={cn(
            'text-7xl md:text-8xl lg:text-9xl select-none transition-transform duration-300',
            stage === 'threat' && 'animate-monster-idle-threat',
            stage === 'battle' && 'animate-monster-idle-battle',
            stage === 'victory' && 'animate-monster-flee'
          )}
          role="img"
          aria-label={config.name}
        >
          {config.emoji}
        </span>

        {/* Hit flash overlay */}
        {isHit && (
          <div className="absolute inset-0 rounded-full bg-red-500/50 animate-pulse" />
        )}

        {/* Victory stars */}
        {stage === 'victory' && (
          <>
            <span className="absolute -top-2 -left-2 text-2xl animate-bounce">⭐</span>
            <span className="absolute -top-4 right-2 text-xl animate-bounce delay-100">✨</span>
            <span className="absolute -bottom-2 -right-2 text-2xl animate-bounce delay-200">🌟</span>
          </>
        )}
      </div>

      {/* Status indicator */}
      <div
        className={cn(
          'absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap',
          stage === 'threat' && 'bg-red-600 text-white',
          stage === 'battle' && 'bg-orange-500 text-white',
          stage === 'victory' && 'bg-green-500 text-white'
        )}
      >
        {stage === 'threat' && '⚠️ Threatening!'}
        {stage === 'battle' && '💥 Weakening!'}
        {stage === 'victory' && '🎉 Defeated!'}
      </div>
    </div>
  );
};

// Health bar component
const HealthBar = ({
  currentHP,
  maxHP,
  stage,
}: {
  currentHP: number;
  maxHP: number;
  stage: 'threat' | 'battle' | 'victory';
}) => {
  const percentage = maxHP > 0 ? (currentHP / maxHP) * 100 : 0;

  return (
    <div className="w-full max-w-xs mx-auto mb-4">
      {/* HP text */}
      <div className="flex justify-between items-center mb-1.5">
        <div className="flex items-center gap-1.5">
          <Heart className="w-4 h-4 text-red-500" fill="currentColor" />
          <span className="text-sm font-bold text-foreground/80">Monster HP</span>
        </div>
        <span className={cn(
          'text-sm font-black tabular-nums',
          stage === 'victory' ? 'text-green-500' : 'text-red-500'
        )}>
          {currentHP} / {maxHP}
        </span>
      </div>

      {/* Health bar container */}
      <div className="relative h-5 bg-gray-800 rounded-full overflow-hidden border-2 border-gray-700 shadow-inner">
        {/* Health bar fill */}
        <div
          className={cn(
            'absolute inset-y-0 left-0 transition-all duration-500 ease-out rounded-full',
            percentage > 60 && 'bg-gradient-to-r from-red-600 to-red-500',
            percentage > 30 && percentage <= 60 && 'bg-gradient-to-r from-orange-600 to-orange-500',
            percentage > 0 && percentage <= 30 && 'bg-gradient-to-r from-yellow-600 to-yellow-500',
            percentage === 0 && 'bg-gradient-to-r from-green-600 to-green-500'
          )}
          style={{ width: `${Math.max(percentage, 0)}%` }}
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>

        {/* Segment lines for RPG feel */}
        <div className="absolute inset-0 flex">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex-1 border-r border-gray-600/50 last:border-r-0"
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Streak counter component
const StreakCounter = ({ streak }: { streak: number }) => {
  if (streak <= 0) return null;

  const message = getStreakMessage(streak);

  return (
    <div className="flex items-center justify-center gap-2 py-2 px-4 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 rounded-full border border-amber-500/30">
      <Flame className="w-5 h-5 text-orange-500" />
      <span className="text-sm md:text-base font-bold text-orange-400">
        {streak > 1 ? `🔥 ${streak} Day Streak!` : message}
      </span>
      <Zap className="w-4 h-4 text-yellow-500" />
    </div>
  );
};

// Main widget component
export const HealthMonsterWidget = ({
  totalMeds,
  completedMeds,
  streak,
}: HealthMonsterWidgetProps) => {
  const {
    currentHP,
    maxHP,
    stage,
    isHit,
    isVictory,
    damageNumbers,
  } = useMonsterBattle({
    totalMeds,
    completedMeds,
  });

  const config = MONSTER_CONFIGS[stage];

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-500 border-2',
        stage === 'threat' && 'border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.2)]',
        stage === 'battle' && 'border-orange-500/50 shadow-[0_0_25px_rgba(249,115,22,0.2)]',
        stage === 'victory' && 'border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.3)]'
      )}
    >
      {/* Background gradient */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br transition-all duration-700',
          config.bgGradient
        )}
      />

      {/* Animated background particles for threat stage */}
      {stage === 'threat' && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute w-2 h-2 bg-red-500/30 rounded-full animate-float-particle-1" />
          <div className="absolute w-3 h-3 bg-orange-500/20 rounded-full animate-float-particle-2" />
          <div className="absolute w-2 h-2 bg-red-400/25 rounded-full animate-float-particle-3" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-lg md:text-xl text-foreground">
              Health Monster Battle
            </h3>
          </div>
          {stage === 'victory' && (
            <Trophy className="w-6 h-6 text-yellow-500 animate-bounce" />
          )}
        </div>

        {/* Streak counter */}
        <div className="mb-4">
          <StreakCounter streak={streak} />
        </div>

        {/* Health bar */}
        <HealthBar currentHP={currentHP} maxHP={maxHP} stage={stage} />

        {/* Monster display area */}
        <div className="relative min-h-[180px] md:min-h-[220px] flex items-center justify-center my-6">
          {/* Damage numbers */}
          {damageNumbers.map((dmg) => (
            <DamageNumber key={dmg.id} damage={dmg.damage} x={dmg.x} y={dmg.y} />
          ))}

          {/* Monster */}
          <MonsterSprite stage={stage} isHit={isHit} isVictory={isVictory} />
        </div>

        {/* Monster description */}
        <p className="text-center text-sm text-muted-foreground mb-4">
          {config.description}
        </p>

        {/* Progress indicator */}
        <div className="text-center mb-4">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Doses completed today
          </span>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-2xl font-black text-primary">{completedMeds}</span>
            <span className="text-lg text-muted-foreground">/</span>
            <span className="text-2xl font-black text-muted-foreground">{totalMeds}</span>
          </div>
        </div>

        {/* Victory message */}
        {stage === 'victory' && (
          <div className="text-center p-4 bg-green-500/20 rounded-xl border border-green-500/30 animate-pulse">
            <span className="text-lg font-bold text-green-400">
              🎉 All doses taken! Monster defeated! 🎉
            </span>
          </div>
        )}
      </div>
    </Card>
  );
};

export default HealthMonsterWidget;

