import { useEffect } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { AchievementToast } from './components/AchievementToast';
import { MilestoneOverlay } from './components/MilestoneOverlay';
import { HamburgerMenu } from './components/HamburgerMenu';
import { NameInputModal } from './components/NameInputModal';
import { TitleScreen } from './components/TitleScreen';
import { useGameStore, SLEEP_COOLDOWN_MIN, HUNGER_MAX } from './store/gameStore';
import { REINCARNATION_WEIGHT_THRESHOLD } from './reincarnation';
import { sound } from './audio/sound';

function formatClock(gameMinutes: number): string {
  const m = ((gameMinutes % 1440) + 1440) % 1440;
  const hh = Math.floor(m / 60).toString().padStart(2, '0');
  const mm = (m % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function App() {
  const {
    screen, mode, name, food, days, weight, hunger, isSleeping, isPaused, gameMinutes, lastWokeAt,
    feed, sleep, tick, enterAction, exitAction,
  } = useGameStore();

  useEffect(() => {
    if (screen !== 'game' || !name || isPaused) return;
    const id = setInterval(() => tick(), 1000);
    return () => clearInterval(id);
  }, [screen, name, isPaused, tick]);

  // BGM: ゲーム画面（名前入力済み）で再生。育成/アクションで曲を切替、タイトルで停止。
  // 実際の発音はユーザー操作で AudioContext がアンロックされてから始まる。
  useEffect(() => {
    if (screen === 'game' && name) sound.startBgm(mode === 'action' ? 'action' : 'care');
    else sound.stopBgm();
  }, [screen, name, mode]);

  const handleFeed = () => {
    feed();
    sound.playSE('feed');
  };
  const handleSleep = () => {
    sleep();
    sound.playSE('sleep');
  };

  const cooldownRemain =
    lastWokeAt === null
      ? 0
      : Math.max(0, SLEEP_COOLDOWN_MIN - (gameMinutes - lastWokeAt));
  const canSleep = !isSleeping && cooldownRemain === 0;
  const sleepStatusLabel = isSleeping
    ? '睡眠中...'
    : canSleep
      ? '睡眠可能'
      : `あと${cooldownRemain}分で\n睡眠可能`;

  // 目的の可視化（#A）: 次の体重節目までの距離
  const nextT = weight < 10 ? 10 : weight < REINCARNATION_WEIGHT_THRESHOLD ? REINCARNATION_WEIGHT_THRESHOLD : null;
  const goalText =
    nextT === null
      ? 'てんせい できる！'
      : `あと ${(nextT - weight).toFixed(1)}kg で ${nextT === REINCARNATION_WEIGHT_THRESHOLD ? 'てんせい' : 'せいちょう'}`;
  // 空腹バー（#A/#B）: 満タンに近いほど危険色
  const hungerPct = Math.min(100, (hunger / HUNGER_MAX) * 100);
  const hungerColor = hunger < 50 ? '#5fa84e' : hunger < 80 ? '#e0b03a' : '#d8453a';

  return (
    <div
      className="relative flex flex-col w-screen h-screen overflow-hidden bg-black text-white"
      style={{ fontFamily: 'var(--pixel-jp)' }}
    >
      {/* 上部: バー領域は常に保持し、内容のみフェード（キャンバスサイズを変えないため） */}
      <div
        className={`flex flex-col gap-2 px-4 pt-16 pb-2 shrink-0 transition-opacity duration-200 ${mode === 'care' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="flex justify-between items-start">
          <div className="text-2xl tabular-nums">
            {formatClock(gameMinutes)} <span>{days}日目</span>
          </div>
          <div className="flex items-start gap-4">
            <div className="grid grid-cols-[auto_auto] gap-x-4 gap-y-2 text-xl tabular-nums">
              <span className="text-right">名前</span>
              <span className="text-right">{name}</span>
              <span className="text-right">体重</span>
              <span className="text-right">{weight.toFixed(1)}kg</span>
            </div>
            <HamburgerMenu />
          </div>
        </div>
        {/* 空腹バー（#B）＋ 目的（#A） */}
        <div className="flex items-center gap-2 text-sm">
          <span className="shrink-0">くうふく</span>
          <div className="flex-1 h-3 border-2 border-white">
            <div
              data-testid="hunger-bar"
              className="h-full transition-[width] duration-300"
              style={{ width: `${hungerPct}%`, backgroundColor: hungerColor }}
            />
          </div>
        </div>
        <div className="text-sm tabular-nums text-right">{goalText}</div>
      </div>

      {/* 中央: Phaser キャンバス（モード問わず常駐、シーンで切替） */}
      <div className="flex-1 relative">
        <GameCanvas />
      </div>

      {/* 名前入力モーダル（ゲーム画面で名前未入力のみ） */}
      {screen === 'game' && !name && <NameInputModal />}

      {/* 実績解除トースト（ゲーム画面のみ） */}
      {screen === 'game' && <AchievementToast />}

      {/* 節目の祝い演出（#D）。ゲーム画面のみ */}
      {screen === 'game' && <MilestoneOverlay />}

      {/* タイトル画面 */}
      {screen === 'title' && <TitleScreen />}

      {/* 睡眠フェードオーバーレイ（画面全体） */}
      <div
        data-testid="sleep-fade"
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-black transition-opacity duration-1000 ${isSleeping ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* 下部: バー領域は常に保持し、内容のみフェード（キャンバスサイズを変えないため） */}
      <div
        className={`flex gap-3 px-4 pt-2 pb-16 shrink-0 transition-opacity duration-200 ${mode === 'care' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <button
          onClick={handleFeed}
          disabled={food <= 0 || isSleeping}
          className="flex-1 py-4 text-white border-2 border-white bg-black active:bg-white active:text-black disabled:opacity-30 disabled:active:bg-black disabled:active:text-white flex flex-col items-center leading-tight"
        >
          <span className="text-lg">ごはん</span>
          <span className="text-sm tabular-nums">残数：{food}</span>
        </button>
        <button
          onClick={handleSleep}
          disabled={!canSleep}
          className="flex-1 py-4 text-white border-2 border-white bg-black active:bg-white active:text-black disabled:opacity-30 disabled:active:bg-black disabled:active:text-white flex flex-col items-center leading-tight"
        >
          <span className="text-lg">ねる</span>
          <span className="text-sm tabular-nums text-center whitespace-pre-line">{sleepStatusLabel}</span>
        </button>
        <button
          data-testid="enter-action"
          onClick={enterAction}
          disabled={isSleeping}
          className="flex-1 py-4 text-white border-2 border-white bg-black active:bg-white active:text-black disabled:opacity-30 disabled:active:bg-black disabled:active:text-white flex flex-col items-center leading-tight"
        >
          <span className="text-lg">あそぶ</span>
          <span className="text-sm">アクション</span>
        </button>
      </div>

      {/* アクションモードの「もどる」ボタン（バー領域の上に絶対配置） */}
      {mode === 'action' && (
        <div className="absolute top-0 left-0 right-0 flex justify-start px-4 pt-16 pb-2 z-10">
          <button
            data-testid="exit-action"
            onClick={exitAction}
            className="px-5 py-2 text-white text-lg border-2 border-white bg-black active:bg-white active:text-black"
          >
            もどる
          </button>
        </div>
      )}
    </div>
  );
}
