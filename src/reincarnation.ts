// 転生（#3）のコアロジック。localStorage / Phaser 非依存の純粋関数群。
// store からはここを呼び、UI からも canReincarnate を使う。

export const REINCARNATION_WEIGHT_THRESHOLD = 25; // この体重(kg)以上で転生可能（adult ステージ）
export const REINCARNATION_FOOD_BONUS = 3; // 転生1回あたり初期ごはん残数に加算
export const REINCARNATION_BASE_FOOD = 8; // 初回ゲームと同じ初期ごはん残数
export const REINCARNATION_INITIAL_WEIGHT = 5.0; // リセット後の体重

// 転生可能か（体重がしきい値以上）。
export function canReincarnate(weight: number): boolean {
  return weight >= REINCARNATION_WEIGHT_THRESHOLD;
}

// 転生でリセット＆ボーナス適用されるフィールドを返す。
// 引き継ぎ対象（name / achievements / 累計カウント）は含めない。
export function reincarnatedFields(prevCount: number) {
  const reincarnationCount = prevCount + 1;
  return {
    reincarnationCount,
    food: REINCARNATION_BASE_FOOD + REINCARNATION_FOOD_BONUS * reincarnationCount,
    weight: REINCARNATION_INITIAL_WEIGHT,
    days: 1,
    isSleeping: false,
    lastWokeAt: null as number | null,
    recentUnlocks: [] as string[],
  };
}
