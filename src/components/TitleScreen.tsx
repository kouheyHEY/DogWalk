import { useGameStore } from '../store/gameStore';
import { titleFor } from '../titles';
import { sound } from '../audio/sound';

export function TitleScreen() {
  const name = useGameStore((s) => s.name);
  const startGame = useGameStore((s) => s.startGame);
  const resetGame = useGameStore((s) => s.resetGame);
  const reincarnationCount = useGameStore((s) => s.reincarnationCount);
  const justDied = useGameStore((s) => s.justDied);
  const hasSave = name !== '';
  const title = titleFor(reincarnationCount); // 称号（#E）

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
      <div className="text-5xl mb-4 tracking-wider">DogWalk</div>

      {/* 永遠の眠りメッセージ（#B・一度きり） */}
      {justDied && (
        <div data-testid="death-message" className="mb-6 text-center text-sm leading-relaxed">
          <div className="text-base">{name} は 永遠の眠りについた…</div>
          <div className="opacity-70 mt-1">（実績・称号・転生回数は引き継がれます）</div>
        </div>
      )}

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
        <div className="mt-6 text-sm opacity-70 text-center">
          <div>セーブデータ: {name}</div>
          {title && <div className="mt-1 text-yellow-300">称号: {title}</div>}
        </div>
      )}
    </div>
  );
}
