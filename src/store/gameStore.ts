import { create } from 'zustand';

interface GameStore {
  food: number;    // ごはんの回数（残数）
  days: number;    // 経過日数
  weight: number;  // 体重 (kg)
}

export const useGameStore = create<GameStore>(() => ({
  food: 8,
  days: 1,
  weight: 5.0,
}));
