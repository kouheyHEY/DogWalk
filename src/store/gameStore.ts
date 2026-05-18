import { create } from 'zustand';

interface GameStore {
  name: string;                // プレイヤーが付けた生物の名前（カタカナ4文字）。空ならゲーム未開始。
  food: number;                // ごはんの回数（残数）
  days: number;                // 経過日数
  weight: number;              // 体重 (kg)
  isSleeping: boolean;         // 睡眠中フラグ
  gameMinutes: number;         // ゲーム内経過分（1日 = 1440 で巻き戻る前提の通算分）
  lastWokeAt: number | null;   // 最後に起きた時刻（gameMinutes基準）。null なら未睡眠。
  setName: (name: string) => void;
  tick: () => void;
  feed: () => void;
  sleep: () => void;
}

export const NAME_PATTERN = /^[ぁ-ゖァ-ヶー]{1,4}$/; // ひらがな/カタカナ 1〜4文字（長音符含む）

const SLEEP_FADE_MS = 1000;          // フェードアウト/インそれぞれの時間
const SLEEP_ELAPSED_MIN = 5 * 60;    // 睡眠中に進めるゲーム内分（5時間）
const SLEEP_COOLDOWN_MIN = 6 * 60;   // 起床後この時間経過で再度寝られる（6時間）
const INITIAL_GAME_MINUTES = 8 * 60; // 8:00 スタート

export const useGameStore = create<GameStore>((set, get) => ({
  name: '',
  food: 8,
  days: 1,
  weight: 5.0,
  isSleeping: false,
  gameMinutes: INITIAL_GAME_MINUTES,
  lastWokeAt: null,
  setName: (name) => {
    if (!NAME_PATTERN.test(name)) return;
    set({ name });
  },
  tick: () => set((s) => ({ gameMinutes: s.gameMinutes + 1 })),
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
      const advanced = get().gameMinutes + SLEEP_ELAPSED_MIN;
      set({ isSleeping: false, gameMinutes: advanced, lastWokeAt: advanced });
    }, SLEEP_FADE_MS);
  },
}));

export { SLEEP_COOLDOWN_MIN };
