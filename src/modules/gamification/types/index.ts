export type MonsterStage = 'threat' | 'battle' | 'victory';

export interface MonsterConfig {
  stage: MonsterStage;
  name: string;
  emoji: string;
  description: string;
  color: string;
  bgGradient: string;
}

export interface DamageNumberProps {
  id: string;
  damage: number;
  x: number;
  y: number;
}

export interface HealthMonsterWidgetProps {
  totalMeds: number;
  completedMeds: number;
  streak: number;
  onMedicationTaken?: () => void;
}

export interface MonsterBattleState {
  currentHP: number;
  maxHP: number;
  stage: MonsterStage;
  progress: number;
  isHit: boolean;
  isVictory: boolean;
  damageNumbers: DamageNumberProps[];
}

