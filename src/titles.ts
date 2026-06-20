// 称号（#E）。転生回数 5 の倍数ごとに新しい称号を獲得する。純粋ロジック。

export const TITLE_STEP = 5; // この回数ごとに称号が更新される

export const TITLES: ReadonlyArray<string> = [
  'みならいのぬし', // 5回
  'いちにんまえのぬし', // 10回
  'ベテランのぬし', // 15回
  'めいじんのぬし', // 20回
  'でんせつのぬし', // 25回
];

// 転生回数に対する現在の称号。未到達（5回未満）は null。
// TITLES を超えた回数は最後の称号に ★n を付ける。
export function titleFor(reincarnationCount: number): string | null {
  if (reincarnationCount < TITLE_STEP) return null;
  const idx = Math.floor(reincarnationCount / TITLE_STEP) - 1; // 5→0, 10→1, ...
  if (idx < TITLES.length) return TITLES[idx];
  const extra = idx - (TITLES.length - 1); // 最後の称号からの超過段階
  return `${TITLES[TITLES.length - 1]}★${extra}`;
}

// その転生でちょうど新しい称号に到達したか（演出トリガー用）。
export function isTitleMilestone(reincarnationCount: number): boolean {
  return reincarnationCount > 0 && reincarnationCount % TITLE_STEP === 0;
}
