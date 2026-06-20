import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, HUNGER_MAX } from './gameStore';

// 各テスト前に育成中の素直な状態へ初期化（シングルトンを共有するため）
beforeEach(() => {
  useGameStore.setState({
    screen: 'game', mode: 'care', name: 'テス', food: 8, days: 1, weight: 5, hunger: 0,
    isSleeping: false, isPaused: false, gameMinutes: 480, lastWokeAt: null,
    totalFeedCount: 0, totalSleepCount: 0, achievements: {}, recentUnlocks: [],
    milestones: [], reincarnationCount: 0, justDied: false,
  });
});

describe('空腹（#B）', () => {
  it('feed で空腹が減り、体重が増え、ごはんが1減る', () => {
    useGameStore.setState({ hunger: 50 });
    useGameStore.getState().feed();
    const s = useGameStore.getState();
    expect(s.hunger).toBe(10); // 50 - 40
    expect(s.weight).toBe(5.5);
    expect(s.food).toBe(7);
  });

  it('feed は空腹を0未満にしない', () => {
    useGameStore.setState({ hunger: 10 });
    useGameStore.getState().feed();
    expect(useGameStore.getState().hunger).toBe(0);
  });

  it('tick で空腹が増える', () => {
    const before = useGameStore.getState().hunger;
    useGameStore.getState().tick();
    expect(useGameStore.getState().hunger).toBeGreaterThan(before);
  });
});

describe('永遠の眠り（#B）', () => {
  it('空腹が限界でリセット＋タイトルへ、メタは引き継ぐ', () => {
    useGameStore.setState({
      hunger: HUNGER_MAX - 0.01, weight: 20, days: 9, food: 2,
      reincarnationCount: 3, achievements: { 'weight-10': true }, name: 'ポチ',
    });
    useGameStore.getState().tick();
    const s = useGameStore.getState();
    // リセット
    expect(s.screen).toBe('title');
    expect(s.justDied).toBe(true);
    expect(s.weight).toBe(5);
    expect(s.days).toBe(1);
    expect(s.hunger).toBe(0);
    // メタ引き継ぎ
    expect(s.name).toBe('ポチ');
    expect(s.reincarnationCount).toBe(3);
    expect(s.achievements).toEqual({ 'weight-10': true });
  });
});

describe('節目演出キュー（#D/#E）', () => {
  it('体重が10kgを跨ぐと milestones に積まれる', () => {
    useGameStore.setState({ weight: 9.6, milestones: [] });
    useGameStore.getState().feed(); // 9.6 -> 10.1
    expect(useGameStore.getState().milestones).toContain('10kg');
  });

  it('転生回数が5の倍数で称号の節目が積まれる', () => {
    useGameStore.setState({ weight: 26, mode: 'care', isSleeping: false, reincarnationCount: 4, milestones: [] });
    useGameStore.getState().reincarnate();
    const s = useGameStore.getState();
    expect(s.reincarnationCount).toBe(5);
    expect(s.milestones).toContain('てんせい');
    expect(s.milestones.some((m) => m.includes('称号'))).toBe(true);
  });
});
