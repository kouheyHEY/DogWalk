import { useEffect } from 'react';
import { ACHIEVEMENTS } from '../achievements';
import { useGameStore } from '../store/gameStore';
import { sound } from '../audio/sound';

const TOAST_DURATION_MS = 3000;

export function AchievementToast() {
  const currentId = useGameStore((s) => s.recentUnlocks[0] ?? null);
  const consumeUnlock = useGameStore((s) => s.consumeUnlock);

  useEffect(() => {
    if (!currentId) return;
    sound.playSE('achievement');
    const id = setTimeout(() => consumeUnlock(), TOAST_DURATION_MS);
    return () => clearTimeout(id);
  }, [currentId, consumeUnlock]);

  if (!currentId) return null;
  const achievement = ACHIEVEMENTS.find((a) => a.id === currentId);
  if (!achievement) return null;

  return (
    <div
      data-testid="achievement-toast"
      className="absolute left-1/2 -translate-x-1/2 bottom-32 z-40 px-5 py-3 bg-black border-2 border-white text-white text-center pointer-events-none shadow-lg"
    >
      <div className="text-xs opacity-70 mb-1">実績解除!</div>
      <div className="text-lg leading-tight">{achievement.title}</div>
      <div className="text-xs opacity-80 mt-1">{achievement.description}</div>
    </div>
  );
}
