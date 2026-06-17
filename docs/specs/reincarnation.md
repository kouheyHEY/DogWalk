# Spec — 転生機能（#3）

## Problem / why
成長しきった（最終ステージ adult に達した）生物に、その先の遊びがない。
「転生」で実績やボーナスを引き継いで再スタートでき、周回プレイの動機を作る。

## Goal
育成画面のメニューから、体重25kg以上の生物を「転生」させると、名前・実績・
累計カウントを引き継いだまま初期状態に戻り、転生回数に応じて初期ごはん残数が
増えた状態で再スタートできる。

## Acceptance criteria
- [ ] AC1: `canReincarnate(weight)` は weight ≥ 25 で true、未満で false。
- [ ] AC2: 転生すると `reincarnationCount` が +1 される。
- [ ] AC3: 転生後の初期ごはん残数 = `8 + 3 × (新しい reincarnationCount)`。
      （1回目→11、2回目→14 …）
- [ ] AC4: 転生で `weight=5.0` / `days=1` / `gameMinutes`=初期(8:00) / `lastWokeAt=null`
      / `isSleeping=false` にリセットされる。
- [ ] AC5: 転生後も `name` / `achievements` / `totalFeedCount` / `totalSleepCount` は保持。
- [ ] AC6: `reincarnationCount` は localStorage に永続化される。
- [ ] AC7: UI: 育成メニュー（ハンバーガー）に「てんせい」項目。weight<25 のときは
      押せない（無効表示）。weight≥25 で押下 → 確認ダイアログ → 実行。
- [ ] Edge: weight ちょうど 25.0 は転生可能（境界含む）。

## Scope / non-goals
In: 発動条件判定 / 状態リセット＆引き継ぎ / 初期ごはんボーナス / 転生回数保存 /
    メニュー導線＋確認ダイアログ。
Out（今はやらない）:
  - 見た目バリエーション（ステージ別スプライト素材が無いため）
  - 転生カットイン演出（最小はフェード or 即時）
  - 初期体重アップ・成長速度アップ等の追加ボーナス（将来拡張）

## Open questions
（AskUserQuestion で解決済み）
- 発動条件 = 体重25kg以上（adult 到達）
- ボーナス = 初期ごはん残数アップのみ
- 名前 = 引き継ぐ

## Assumptions（指摘なければこのまま進める）
- ボーナス係数は 1 転生あたり +3 ごはん（`REINCARNATION_FOOD_BONUS=3`）。
- 転生は育成モード（mode='care'）でのみ可能。アクション中・睡眠中は不可。
- `recentUnlocks` キューは転生でクリア（次の生で持ち越さない）。
- 確認ダイアログでキャンセルしたら何も起きない。
- コアロジックは純粋関数 `src/reincarnation.ts` に置き、store から呼ぶ
  （localStorage 非依存で単体テスト可能にする）。
