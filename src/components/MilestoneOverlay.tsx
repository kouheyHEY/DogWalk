import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { sound } from '../audio/sound';

const MILESTONE_DURATION_MS = 2000;

// 節目（体重10/25kg・てんせい・称号）の祝い演出。中央にフラッシュ＋ファンファーレ。
export function MilestoneOverlay() {
  const current = useGameStore((s) => s.milestones[0] ?? null);
  const consumeMilestone = useGameStore((s) => s.consumeMilestone);

  useEffect(() => {
    if (!current) return;
    sound.playSE('fanfare');
    const id = setTimeout(() => consumeMilestone(), MILESTONE_DURATION_MS);
    return () => clearTimeout(id);
  }, [current, consumeMilestone]);

  if (!current) return null;

  return (
    <div
      data-testid="milestone-overlay"
      className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
    >
      <div className="px-8 py-5 bg-black/85 border-4 border-yellow-300 text-center animate-pulse">
        <div className="text-sm text-yellow-300 mb-2 tracking-widest">★ NEW ★</div>
        <div className="text-2xl text-white leading-tight">{current}</div>
      </div>
    </div>
  );
}
