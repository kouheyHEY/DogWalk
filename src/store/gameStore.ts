import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
  startGame: () => void;
  resetGame: () => void;
  goToTitle: () => void;
  setPaused: (paused: boolean) => void;
  setName: (name: string) => void;
  tick: () => void;
  feed: () => void;
  sleep: () => void;
}

const INITIAL_STATE = {
  name: '',
  food: 8,
  days: 1,
  weight: 5.0,
  isSleeping: false,
  lastWokeAt: null as number | null,
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
    return dayDiff > 0
      ? {
          gameMinutes: next,
          days: s.days + dayDiff,
          weight: s.weight + DAILY_WEIGHT_GAIN * dayDiff,
        }
      : { gameMinutes: next };
  }),
  feed: () =>
    set((s) =>
      s.isSleeping || s.food <= 0
        ? s
        : { food: s.food - 1, weight: s.weight + 0.5 }
    ),
  sleep: () => {
    const s = get();
    if (s.isSleeping) return;
    if (s.lastWokeAt !== null && s.gameMinutes - s.lastWokeAt < SLEEP_COOLDOWN_MIN) return;
    set({ isSleeping: true });
    // フェードアウト完了タイミングで時間ジャンプ＆起床（その後フェードインへ）
    setTimeout(() => {
      const cur = get();
      const advanced = cur.gameMinutes + SLEEP_ELAPSED_MIN;
      const dayDiff = dayIndex(advanced) - dayIndex(cur.gameMinutes);
      set({
        isSleeping: false,
        gameMinutes: advanced,
        lastWokeAt: advanced,
        days: cur.days + dayDiff,
        weight: cur.weight + DAILY_WEIGHT_GAIN * dayDiff,
      });
    }, SLEEP_FADE_MS);
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
      }),
    },
  ),
);

export { SLEEP_COOLDOWN_MIN };
