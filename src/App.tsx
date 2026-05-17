import { GameCanvas } from './components/GameCanvas';
import { useGameStore } from './store/gameStore';

export default function App() {
  const { food, days, weight } = useGameStore();

  return (
    <div
      className="flex flex-col w-screen h-screen overflow-hidden bg-black text-white"
      style={{ fontFamily: 'var(--pixel-jp)' }}
    >
      {/* 上部: 右上にステータスを集約（ラベル＝値） */}
      <div className="flex justify-end px-4 pt-16 pb-2 shrink-0">
        <div className="grid grid-cols-[auto_auto] gap-x-4 gap-y-2 text-xl tabular-nums">
          <span className="text-right">ごはん</span>
          <span className="text-right">{food}</span>
          <span className="text-right">経過日数</span>
          <span className="text-right">{days}</span>
          <span className="text-right">体重</span>
          <span className="text-right">{weight.toFixed(1)}kg</span>
        </div>
      </div>

      {/* 中央: 犬 */}
      <div className="flex-1 relative">
        <GameCanvas />
      </div>

      {/* 下部: 操作ボタン */}
      <div className="flex gap-3 px-4 pt-2 pb-16 shrink-0">
        <button
          onClick={() => { /* TODO: ごはんを与える */ }}
          className="flex-1 py-4 text-white text-lg border-2 border-white bg-black active:bg-white active:text-black"
        >
          ごはん
        </button>
        <button
          onClick={() => { /* TODO: ねかせる */ }}
          className="flex-1 py-4 text-white text-lg border-2 border-white bg-black active:bg-white active:text-black"
        >
          ねる
        </button>
      </div>
    </div>
  );
}
