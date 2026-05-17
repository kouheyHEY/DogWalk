import { useGameStore } from '../store/gameStore';

function RetroGauge({ value, color }: { value: number; color: string }) {
  return (
    <div className="retro-gauge flex-1 h-4">
      <div className="retro-gauge-fill" style={{ width: `${value}%`, backgroundColor: color }} />
    </div>
  );
}

export function StatusBar() {
  const { stamina, motivation, food, distance } = useGameStore();

  return (
    <div className="retro-panel px-3 pt-2 pb-2 shrink-0 space-y-1.5">
      {/* 上段：距離 + 食料 */}
      <div className="flex justify-between items-center">
        <span className="text-[9px]" style={{ color: 'var(--gold)' }}>
          {String(Math.floor(distance)).padStart(6, '0')}m
        </span>
        <span className="text-[9px]" style={{ color: 'var(--food)' }}>
          FOOD:{String(food).padStart(2, '0')}
        </span>
      </div>

      {/* HP ゲージ */}
      <div className="flex items-center gap-2">
        <span className="text-[8px] w-6 shrink-0" style={{ color: 'var(--hp)' }}>HP</span>
        <RetroGauge value={stamina} color="var(--hp)" />
        <span className="text-[8px] w-7 text-right tabular-nums shrink-0">
          {Math.floor(stamina)}
        </span>
      </div>

      {/* MP ゲージ */}
      <div className="flex items-center gap-2">
        <span className="text-[8px] w-6 shrink-0" style={{ color: 'var(--mp)' }}>MP</span>
        <RetroGauge value={motivation} color="var(--mp)" />
        <span className="text-[8px] w-7 text-right tabular-nums shrink-0">
          {Math.floor(motivation)}
        </span>
      </div>
    </div>
  );
}
