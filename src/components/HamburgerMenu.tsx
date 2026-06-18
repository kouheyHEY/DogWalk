import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { AchievementsDialog } from './AchievementsDialog';
import {
  canReincarnate,
  REINCARNATION_WEIGHT_THRESHOLD,
} from '../reincarnation';
import { titleFor } from '../titles';
import { sound } from '../audio/sound';

export function HamburgerMenu() {
  const goToTitle = useGameStore((s) => s.goToTitle);
  const setPaused = useGameStore((s) => s.setPaused);
  const weight = useGameStore((s) => s.weight);
  const reincarnationCount = useGameStore((s) => s.reincarnationCount);
  const reincarnate = useGameStore((s) => s.reincarnate);
  const [menuOpen, setMenuOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [reincarnateOpen, setReincarnateOpen] = useState(false);
  const [muted, setMuted] = useState(sound.muted);

  const toggleMute = () => setMuted(sound.toggleMuted());

  const reincarnatable = canReincarnate(weight);

  const openMenu = () => {
    setMenuOpen(true);
    setPaused(true);
  };
  const closeMenu = () => {
    setMenuOpen(false);
    setPaused(false);
  };
  const openAchievements = () => {
    // メニューだけ閉じて、ポーズはダイアログ側で継続
    setMenuOpen(false);
    setAchievementsOpen(true);
  };
  const closeAchievements = () => {
    setAchievementsOpen(false);
    setPaused(false);
  };
  const openReincarnate = () => {
    setMenuOpen(false);
    setReincarnateOpen(true);
  };
  const cancelReincarnate = () => {
    setReincarnateOpen(false);
    setPaused(false);
  };
  const confirmReincarnate = () => {
    reincarnate();
    setReincarnateOpen(false);
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

      {menuOpen && (
        <div
          data-testid="menu-dialog"
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/80"
          onClick={closeMenu}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-black border-2 border-white p-6 flex flex-col gap-3 w-64"
          >
            <div className="text-lg text-center mb-1">メニュー（一時停止中）</div>
            {titleFor(reincarnationCount) && (
              <div className="text-center text-xs text-yellow-300 mb-2">
                称号: {titleFor(reincarnationCount)}
              </div>
            )}
            <button
              data-testid="menu-achievements"
              onClick={openAchievements}
              className="py-3 text-lg border-2 border-white bg-black text-white active:bg-white active:text-black"
            >
              実績
            </button>
            <button
              data-testid="menu-reincarnate"
              onClick={openReincarnate}
              disabled={!reincarnatable}
              className="py-3 text-lg border-2 border-white bg-black text-white active:bg-white active:text-black disabled:opacity-30 disabled:active:bg-black disabled:active:text-white flex flex-col items-center leading-tight"
            >
              <span>てんせい</span>
              {!reincarnatable && (
                <span className="text-xs opacity-80">
                  体重{REINCARNATION_WEIGHT_THRESHOLD}kgで可能
                </span>
              )}
            </button>
            <button
              data-testid="menu-mute"
              onClick={toggleMute}
              className="py-3 text-lg border-2 border-white bg-black text-white active:bg-white active:text-black"
            >
              サウンド：{muted ? 'OFF' : 'ON'}
            </button>
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

      {achievementsOpen && <AchievementsDialog onClose={closeAchievements} />}

      {reincarnateOpen && (
        <div
          data-testid="reincarnate-dialog"
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/80"
          onClick={cancelReincarnate}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-black border-2 border-white p-6 flex flex-col gap-3 w-72"
          >
            <div className="text-lg text-center">てんせいする？</div>
            <p className="text-sm leading-relaxed opacity-90">
              いまの体重・日数はリセットされます。なまえ・実績・累計は
              引き継ぎ、つぎは初期ごはんが増えます。
            </p>
            <div className="text-xs opacity-70 text-center">
              これまでの転生回数: {reincarnationCount}
            </div>
            <button
              data-testid="reincarnate-confirm"
              onClick={confirmReincarnate}
              className="py-3 text-lg border-2 border-white bg-black text-white active:bg-white active:text-black"
            >
              てんせいする
            </button>
            <button
              data-testid="reincarnate-cancel"
              onClick={cancelReincarnate}
              className="py-2 text-sm border border-white/50 bg-black text-white/80 active:bg-white/20"
            >
              やめる
            </button>
          </div>
        </div>
      )}
    </>
  );
}
