import { ACHIEVEMENTS } from '../achievements';
import { useGameStore } from '../store/gameStore';

interface Props {
  onClose: () => void;
}

export function AchievementsDialog({ onClose }: Props) {
  const achievements = useGameStore((s) => s.achievements);
  const total = ACHIEVEMENTS.length;
  const unlockedCount = ACHIEVEMENTS.filter((a) => achievements[a.id]).length;

  return (
    <div
      data-testid="achievements-dialog"
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-black border-2 border-white p-5 w-72 max-h-[80vh] flex flex-col gap-3"
      >
        <div className="text-lg text-center">
          実績 ({unlockedCount}/{total})
        </div>
        <ul className="flex flex-col gap-2 overflow-y-auto">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = !!achievements[a.id];
            return (
              <li
                key={a.id}
                data-testid={`achievement-row-${a.id}`}
                className={`border ${unlocked ? 'border-white' : 'border-white/30'} p-2 ${unlocked ? '' : 'opacity-50'}`}
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-base">{unlocked ? '★' : '☆'}</span>
                  <span className="text-base">{unlocked ? a.title : '？？？'}</span>
                </div>
                <div className="text-xs opacity-80 mt-1">
                  {unlocked ? a.description : '未解除'}
                </div>
              </li>
            );
          })}
        </ul>
        <button
          data-testid="achievements-close"
          onClick={onClose}
          className="py-2 text-sm border border-white/50 bg-black text-white/80 active:bg-white/20"
        >
          とじる
        </button>
      </div>
    </div>
  );
}
