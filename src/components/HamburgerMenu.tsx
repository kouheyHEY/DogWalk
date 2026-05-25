import { useState } from 'react';
import { useGameStore } from '../store/gameStore';

export function HamburgerMenu() {
  const goToTitle = useGameStore((s) => s.goToTitle);
  const setPaused = useGameStore((s) => s.setPaused);
  const [open, setOpen] = useState(false);

  const openMenu = () => {
    setOpen(true);
    setPaused(true);
  };
  const closeMenu = () => {
    setOpen(false);
    setPaused(false);
  };

  return (
    <>
      <button
        data-testid="menu-open"
        onClick={openMenu}
        aria-label="メニュー"
        className="w-10 h-10 text-2xl text-white border-2 border-white bg-black flex items-center justify-center leading-none active:bg-white active:text-black"
      >
        ≡
      </button>

      {open && (
        <div
          data-testid="menu-dialog"
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/80"
          onClick={closeMenu}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-black border-2 border-white p-6 flex flex-col gap-3 w-64"
          >
            <div className="text-lg text-center mb-2">メニュー（一時停止中）</div>
            <button
              data-testid="menu-to-title"
              onClick={() => {
                closeMenu();
                goToTitle();
              }}
              className="py-3 text-lg border-2 border-white bg-black text-white active:bg-white active:text-black"
            >
              タイトルへ戻る
            </button>
            <button
              data-testid="menu-close"
              onClick={closeMenu}
              className="py-2 text-sm border border-white/50 bg-black text-white/80 active:bg-white/20"
            >
              とじる
            </button>
          </div>
        </div>
      )}
    </>
  );
}
