// 実績の定義と判定ロジック。
// store の循環依存を避けるため、必要なフィールドだけを受け取る軽量な型で判定する。

export interface AchievementContext {
  totalFeedCount: number;
  totalSleepCount: number;
  days: number;
  weight: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  check: (ctx: AchievementContext) => boolean;
}

export const ACHIEVEMENTS: ReadonlyArray<Achievement> = [
  {
    id: 'first-feed',
    title: 'はじめてのごはん',
    description: 'はじめてごはんをあげた',
    check: (c) => c.totalFeedCount >= 1,
  },
  {
    id: 'first-sleep',
    title: 'はじめてのねむり',
    description: 'はじめてねかせた',
    check: (c) => c.totalSleepCount >= 1,
  },
  {
    id: 'days-3',
    title: 'みっかぼうず',
    description: '3日生きのびた',
    check: (c) => c.days >= 3,
  },
  {
    id: 'days-7',
    title: '1しゅうかんせいかつ',
    description: '7日生きのびた',
    check: (c) => c.days >= 7,
  },
  {
    id: 'weight-10',
    title: 'おおきくなってきた',
    description: '体重 10kg に到達',
    check: (c) => c.weight >= 10,
  },
  {
    id: 'weight-25',
    title: 'りっぱなおとな',
    description: '体重 25kg に到達',
    check: (c) => c.weight >= 25,
  },
  {
    id: 'feed-10',
    title: 'ごはんマスター',
    description: 'ごはんを10回あげた',
    check: (c) => c.totalFeedCount >= 10,
  },
  {
    id: 'sleep-5',
    title: 'ねむりじょうず',
    description: 'ねかせた回数が5回',
    check: (c) => c.totalSleepCount >= 5,
  },
];

/**
 * 与えられた状態に対して、まだ解除されていない実績のうち条件を満たすものの id を返す。
 */
export function findNewlyUnlocked(
  ctx: AchievementContext,
  alreadyUnlocked: Record<string, boolean>,
): string[] {
  return ACHIEVEMENTS
    .filter((a) => !alreadyUnlocked[a.id] && a.check(ctx))
    .map((a) => a.id);
}
