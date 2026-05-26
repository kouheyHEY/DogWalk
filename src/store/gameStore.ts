import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { findNewlyUnlocked } from '../achievements';

export type Screen = 'title' | 'game';

interface GameStore {
  screen: Screen;              // 現在表示中の画面
  name: string;                // プレイヤーが付けた生物の名前（カタカナ4文字）。空ならゲーム未開始。
  food: number;                // ごはんの回数（残数）
  days: number;                // 経過日数
  weight: number;              // 体重 (kg)
  isSleeping: boolean;         // 睡眠中フラグ
  isPaused: boolean;           // モーダル/メニュー表示中などの一時停止フラグ
  gameMinutes: number;         // ゲーム内経過分（1日 = 1440 で巻き戻る前提の通算分）
  lastWokeAt: number | null;   // 最後に起きた時刻（gameMinutes基準）。null なら未睡眠。
  totalFeedCount: number;      // ごはんを与えた累計回数
  totalSleepCount: number;     // 睡眠を取った累計回数
  achievements: Record<string, boolean>; // 実績id → 解除済みフラグ
  recentUnlocks: string[];     // 直近で解除された実績id（トースト通知などのキュー）
  startGame: () => void;
  resetGame: () => void;
  goToTitle: () => void;
  setPaused: (paused: boolean) => void;
  setName: (name: string) => void;
  tick: () => void;
  feed: () => void;
  sleep: () => void;
  consumeUnlock: () => string | null; // recentUnlocks の先頭を取り出して返す（UI用）
}

const INITIAL_STATE = {
  name: '',
  food: 8,
  days: 1,
  weight: 5.0,
  isSleeping: false,
  lastWokeAt: null as number | null,
  totalFeedCount: 0,
  totalSleepCount: 0,
  achievements: {} as Record<string, boolean>,
  recentUnlocks: [] as string[],
};

export const NAME_PATTERN = /^[ぁ-ゖァ-ヶー]{1,4}$/; // ひらがな/カタカナ 1〜4文字（長音符含む）

export type Stage = 'baby' | 'child' | 'adult';

// 体重しきい値（仮）。素材が揃ったら見直し
const STAGE_THRESHOLDS: ReadonlyArray<{ min: number; stage: Stage; stageNo: number }> = [
  { min: 25, stage: 'adult', stageNo: 3 },
  { min: 10, stage: 'child', stageNo: 2 },
  { min: 0,  stage: 'baby',  stageNo: 1 },
];

export function stageOf(weight: number): Stage {
  return (STAGE_THRESHOLDS.find((s) => weight >= s.min) ?? STAGE_THRESHOLDS[2]).stage;
}

export function stageNoOf(weight: number): number {
  return (STAGE_THRESHOLDS.find((s) => weight >= s.min) ?? STAGE_THRESHOLDS[2]).stageNo;
}

const SLEEP_FADE_MS = 1000;          // フェードアウト/インそれぞれの時間
const SLEEP_ELAPSED_MIN = 5 * 60;    // 睡眠中に進めるゲーム内分（5時間）
const SLEEP_COOLDOWN_MIN = 6 * 60;   // 起床後この時間経過で再度寝られる（6時間）
const INITIAL_GAME_MINUTES = 8 * 60; // 8:00 スタート
const MINUTES_PER_DAY = 24 * 60;     // 1日 = 1440 ゲーム内分
const DAILY_WEIGHT_GAIN = 0.2;       // 1日あたりの体重自然増 (kg)

function dayIndex(min: number): number {
  return Math.floor(min / MINUTES_PER_DAY);
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
  screen: 'title',
  ...INITIAL_STATE,
  isPaused: false,
  gameMinutes: INITIAL_GAME_MINUTES,
  startGame: () => set({ screen: 'game' }),
  goToTitle: () => set({ screen: 'title', isPaused: false }),
  setPaused: (paused) => set({ isPaused: paused }),
  resetGame: () =>
    set({
      ...INITIAL_STATE,
      gameMinutes: INITIAL_GAME_MINUTES,
      isPaused: false,
      screen: 'game',
    }),
  setName: (name) => {
    if (!NAME_PATTERN.test(name)) return;
    set({ name });
  },
  tick: () => set((s) => {
    const next = s.gameMinutes + 1;
    const dayDiff = dayIndex(next) - dayIndex(s.gameMinutes);
    if (dayDiff === 0) return { gameMinutes: next };
    const nextDays = s.days + dayDiff;
    const nextWeight = s.weight + DAILY_WEIGHT_GAIN * dayDiff;
    const newlyUnlocked = findNewlyUnlocked(
      { totalFeedCount: s.totalFeedCount, totalSleepCount: s.totalSleepCount, days: nextDays, weight: nextWeight },
      s.achievements,
    );
    return {
      gameMinutes: next,
      days: nextDays,
      weight: nextWeight,
      ...(newlyUnlocked.length > 0 && {
        achievements: { ...s.achievements, ...Object.fromEntries(newlyUnlocked.map((id) => [id, true])) },
        recentUnlocks: [...s.recentUnlocks, ...newlyUnlocked],
      }),
    };
  }),
  feed: () =>
    set((s) => {
      if (s.isSleeping || s.food <= 0) return s;
      const next = {
        food: s.food - 1,
        weight: s.weight + 0.5,
        totalFeedCount: s.totalFeedCount + 1,
      };
      const newlyUnlocked = findNewlyUnlocked(
        { totalFeedCount: next.totalFeedCount, totalSleepCount: s.totalSleepCount, days: s.days, weight: next.weight },
        s.achievements,
      );
      return newlyUnlocked.length === 0
        ? next
        : {
            ...next,
            achievements: { ...s.achievements, ...Object.fromEntries(newlyUnlocked.map((id) => [id, true])) },
            recentUnlocks: [...s.recentUnlocks, ...newlyUnlocked],
          };
    }),
  sleep: () => {
    const s = get();
    if (s.isSleeping) return;
    if (s.lastWokeAt !== null && s.gameMinutes - s.lastWokeAt < SLEEP_COOLDOWN_MIN) return;
    set({ isSleeping: true, totalSleepCount: s.totalSleepCount + 1 });
    // フェードアウト完了タイミングで時間ジャンプ＆起床（その後フェードインへ）
    setTimeout(() => {
      const cur = get();
      const advanced = cur.gameMinutes + SLEEP_ELAPSED_MIN;
      const dayDiff = dayIndex(advanced) - dayIndex(cur.gameMinutes);
      const nextDays = cur.days + dayDiff;
      const nextWeight = cur.weight + DAILY_WEIGHT_GAIN * dayDiff;
      const newlyUnlocked = findNewlyUnlocked(
        { totalFeedCount: cur.totalFeedCount, totalSleepCount: cur.totalSleepCount, days: nextDays, weight: nextWeight },
        cur.achievements,
      );
      set({
        isSleeping: false,
        gameMinutes: advanced,
        lastWokeAt: advanced,
        days: nextDays,
        weight: nextWeight,
        ...(newlyUnlocked.length > 0 && {
          achievements: { ...cur.achievements, ...Object.fromEntries(newlyUnlocked.map((id) => [id, true])) },
          recentUnlocks: [...cur.recentUnlocks, ...newlyUnlocked],
        }),
      });
    }, SLEEP_FADE_MS);
  },
  consumeUnlock: () => {
    const s = get();
    if (s.recentUnlocks.length === 0) return null;
    const [head, ...rest] = s.recentUnlocks;
    set({ recentUnlocks: rest });
    return head;
  },
    }),
    {
      name: 'dogwalk-save',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        name: s.name,
        food: s.food,
        days: s.days,
        weight: s.weight,
        gameMinutes: s.gameMinutes,
        lastWokeAt: s.lastWokeAt,
        totalFeedCount: s.totalFeedCount,
        totalSleepCount: s.totalSleepCount,
        achievements: s.achievements,
      }),
    },
  ),
);

export { SLEEP_COOLDOWN_MIN };
