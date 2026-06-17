import { useGameStore } from '../store/gameStore';
import { sound } from '../audio/sound';

export function TitleScreen() {
  const name = useGameStore((s) => s.name);
  const startGame = useGameStore((s) => s.startGame);
  const resetGame = useGameStore((s) => s.resetGame);
  const hasSave = name !== '';

  // 最初のユーザー操作で AudioContext をアンロック（自動再生制限の解除）
  const handleContinue = () => {
    sound.unlock();
    startGame();
  };
  const handleStart = () => {
    sound.unlock();
    resetGame();
  };

  return (
    <div
      data-testid="title-screen"
      className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black text-white"
    >
      <div className="text-5xl mb-12 tracking-wider">DogWalk</div>
      <div className="flex flex-col gap-3 w-48">
        {hasSave && (
          <button
            data-testid="title-continue"
            onClick={handleContinue}
            className="py-3 text-2xl border-2 border-white bg-black active:bg-white active:text-black"
          >
            つづける
          </button>
        )}
        <button
          data-testid="title-start"
          onClick={handleStart}
          className="py-3 text-2xl border-2 border-white bg-black active:bg-white active:text-black"
        >
          はじめる
        </button>
      </div>
      {hasSave && (
        <div className="mt-6 text-sm opacity-70">
          セーブデータ: {name}
        </div>
      )}
    </div>
  );
}
