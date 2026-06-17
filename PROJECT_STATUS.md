# PROJECT_STATUS — DogWalk（オリジナル生物育成ゲーム）

> 「完成まで」仕上げるための作業状況メモ。**git を正**とする（過去セッションの会話ログには
> 実体と食い違う進捗報告があったため、必ず `git log` / 作業ツリーで裏取りする）。
> 最終更新: 2026-06-17

本番: https://kouheyhey.github.io/DogWalk/

---

## 完了済み（main にマージ済み・本番反映済み）

- #1 成長ロジック（日数・体重の自動進行）
- #4 ごはん / ねる ボタン（state 配線・睡眠フェード・クールダウン）
- #5 タイトル画面（はじめる / つづける、セーブ有無で出し分け、ハンバーガーメニュー）
- #2 実績機能（解除判定・一覧ダイアログ・トースト通知）
- #11 横スクロールアクションモード（前進・ジャンプ・ごはんランダム出現）
- #3 転生機能（条件達成で初期化＋ボーナス、名前/実績/累計は引き継ぎ） … PR #30 `3fbf48f`
- アクションの物理を Arcade Physics に移行（#26〜#29）
- テスト基盤: vitest 導入。`npm test` → **7/7 pass**（`src/reincarnation.test.ts`）

統括 issue #6 のサブイシューはすべて close 済み。

---

## 未コミットの作業ツリー差分

- `src/game/scenes/ActionScene.ts`（M）: 落下＋側面衝突の調整 WIP
  - 重力 4000→2000、ジャンプ初速を下げる、足場の当たり判定を画面外下まで延長
    （`SEGMENT_BELOW_DEPTH`）、落下ゲームオーバー判定を深く（`FALL_EXIT_MARGIN=450`）
  - ねらい: 落下中に「迫ってくる壁」と水平に衝突させる猶予を作る。**未検証**。

---

## 「完成」に向けた残タスク（2026-06-17 ユーザー確定）

> 確定スコープ: A(当たり判定=C案で単純化) → B(リリース整備) → C(成長スプライト) → D(BGM/SE)

### A. アクションモードの当たり判定を単純化（ユーザー確定: C 案）
- 「迫ってくる壁との側面衝突」は**やめる**。穴に落ちたら育成画面へ戻るだけにする。
- 未コミット WIP のうち、足場の画面外下延長（`SEGMENT_BELOW_DEPTH`）と深い落下猶予
  （`FALL_EXIT_MARGIN=450`）は側面衝突のための仕掛けなので**撤回**。落下判定は素直に
  （画面下を少し超えたら戻る）。重力・ジャンプは見た目自然な値に整える。

### B. リリース整備
- `src/game/scenes/ActionScene.ts` の `const DEBUG = true;` → **false**
- `"ACTION (WIP)"` ラベル除去
- ※ A の実機確認に DEBUG 枠を使うため、A 完了後に実施。

### C. スプライト素材（成長ステージの見た目）
- 現状 `public/assets/` は `creature_1_baby_stop.png` のみ。
- 必要: `creature_2_child_stop`, `creature_3_adult_stop`（＋できれば `*_walk_*`）。
- `MainScene.ts` の preload とステージ切替（`stageNoOf(weight)` で 1/2/3）に配線。
- 生成手段: `/pixel-art-draft` スキルで仮ドット絵 PNG を作る（128x128・白・透過）。

### D. 任意ポリッシュ
- アクションのスコア/結果を育成側へ還元（取得ごはん→`food` 等、一部実装済みか要確認）
- 状態異常（空腹・眠気）のセリフ/表現
- BGM / SE（`/midi-composer` で seed を作る）

---

## 環境メモ（重要）

- **Bash はマルチバイトパスで cwd がずれる**ことがある。git は `git -C "<worktree>"` を使う。
  worktree: `C:\personal\02_ゲーム開発\02_プロダクト\DogWalk\.claude\worktrees\tender-golick-5cc4ae`
- preview/スクショは ActionScene（Phaser WebGL）で最初のフレームが黒く写ることがあり、
  アクションの目視検証は不安定。育成画面の検証は安定。
- Python 不在。スクリプトは node を使う。
- `CLAUDE.md` の「ボタン未配線」等の記述は**古い**。実装は本ファイルと git を正とする。

---

## 再開手順

1. `git -C "<worktree>" status` / `diff` で未コミット差分を把握
2. `npm test` でグリーン確認（現状 7/7）
3. 残タスク A → B → C → D の順で dev-loop を回す
