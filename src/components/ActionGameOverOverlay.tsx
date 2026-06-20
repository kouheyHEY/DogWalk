import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { sound } from '../audio/sound';

const GAMEOVER_DURATION_MS = 1800;

// アクションのゲームオーバー演出。文言を一定時間見せてから育成画面へ戻す。
export function ActionGameOverOverlay() {
  const over = useGameStore((s) => s.actionGameOver);
  const exitAction = useGameStore((s) => s.exitAction);

  useEffect(() => {
    if (!over) return;
    sound.playSE('gameover');
    const id = setTimeout(() => exitAction(), GAMEOVER_DURATION_MS);
    return () => clearTimeout(id);
  }, [over, exitAction]);

  if (!over) return null;

  return (
    <div
      data-testid="action-gameover"
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 text-white pointer-events-none"
    >
      <div className="text-4xl tracking-widest mb-3">ゲームオーバー</div>
      <div className="text-sm opacity-80">育成にもどる…</div>
    </div>
  );
}
