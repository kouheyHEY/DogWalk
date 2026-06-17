import { describe, it, expect } from 'vitest';
import {
  canReincarnate,
  reincarnatedFields,
  REINCARNATION_WEIGHT_THRESHOLD,
} from './reincarnation';

describe('canReincarnate (AC1, Edge)', () => {
  it('体重がしきい値未満なら転生不可', () => {
    expect(canReincarnate(0)).toBe(false);
    expect(canReincarnate(24.9)).toBe(false);
  });

  it('体重がしきい値ちょうど（25.0）で転生可能', () => {
    expect(canReincarnate(REINCARNATION_WEIGHT_THRESHOLD)).toBe(true);
  });

  it('体重がしきい値超で転生可能', () => {
    expect(canReincarnate(100)).toBe(true);
  });
});

describe('reincarnatedFields (AC2, AC3, AC4)', () => {
  it('AC2: reincarnationCount が +1 される', () => {
    expect(reincarnatedFields(0).reincarnationCount).toBe(1);
    expect(reincarnatedFields(3).reincarnationCount).toBe(4);
  });

  it('AC3: 初期ごはん残数 = 8 + 3 × 新カウント', () => {
    expect(reincarnatedFields(0).food).toBe(11); // 1回目
    expect(reincarnatedFields(1).food).toBe(14); // 2回目
    expect(reincarnatedFields(4).food).toBe(23); // 5回目
  });

  it('AC4: 状態が初期値にリセットされる', () => {
    const f = reincarnatedFields(2);
    expect(f.weight).toBe(5.0);
    expect(f.days).toBe(1);
    expect(f.isSleeping).toBe(false);
    expect(f.lastWokeAt).toBeNull();
    expect(f.recentUnlocks).toEqual([]);
  });

  it('AC5: 引き継ぎ対象フィールド（name/achievements/累計）は含まない', () => {
    const f = reincarnatedFields(0) as Record<string, unknown>;
    expect(f).not.toHaveProperty('name');
    expect(f).not.toHaveProperty('achievements');
    expect(f).not.toHaveProperty('totalFeedCount');
    expect(f).not.toHaveProperty('totalSleepCount');
  });
});
