# DogWalk リポジトリ — オリジナル生物育成ゲーム

> プロジェクト名は歴史的経緯で `DogWalk` のままだが、ゲーム内容は **オリジナル生物の育成** に変更された。

## ゲームコンセプト

プレイヤーは画面中央のオリジナル生物を **ごはん** と **ねる** で世話する。目的は **生物をどんどん成長させていくこと**。たまごっち風の縦画面ワンレイアウト。

主な機能（実装済み）：
- 育成（ごはん／ねる／日数・体重の自動進行）
- タイトル画面・セーブ（LocalStorage、つづける／はじめる）
- 実績（解除条件・一覧ダイアログ・トースト通知）
- 転生（体重しきい値で初期化＋ボーナス、なまえ／実績／累計は引き継ぎ）
- 横スクロールアクションモード（あそぶ）
- BGM／効果音（WebAudio チップチューン）

成長ステージ：
- 体重で `baby` / `child` / `adult` を判定（`stageOf` / `stageNoOf`）。
- **主人公の絵は `creature_1_baby_stop.png` のみ**。成長の見た目は体重スケール拡大で表現する
  （ユーザー方針で別ステージ絵は持たない）。ステージ別スプライトを足したくなったら
  命名規則 `creature_<stage>_<form>_<motion>.png` で `MainScene.preload` に追記すれば自動切替する。

---

## 現在のステータス指標

| 指標 | 内部キー | 説明 |
|---|---|---|
| ごはん残数 | `food` | プレイヤーが与えられる回数（0で「ごはん」不可） |
| 経過日数 | `days` | ゲーム内日数 |
| 体重 | `weight` | 成長度の数値表現 (kg)。ステージ判定・表示倍率の基準 |
| なまえ | `name` | カタカナ等 1〜4文字。空ならゲーム未開始 |

その他の内部状態: `isSleeping` / `isPaused` / `gameMinutes`（通算分・時計表示）/ `lastWokeAt`（睡眠クールダウン）/
`totalFeedCount` / `totalSleepCount`（実績用累計）/ `achievements` / `recentUnlocks` / `reincarnationCount` /
`screen`（title/game）/ `mode`（care/action）。すべて `src/store/gameStore.ts` に Zustand で保持。
セーブ対象は `persist` の `partialize` を参照（screen/isSleeping/isPaused 等は除外）。

---

## 操作

| ボタン | 効果 |
|---|---|
| ごはん | 食事を与える（`food -1`、`weight +0.5`、効果音）。残数0/睡眠中は不可 |
| ねる | 寝かせる（フェード→時間ジャンプ→起床、クールダウンあり）。効果音 |
| あそぶ | アクションモードへ（横スクロール）。「もどる」で育成へ復帰 |
| ≡（メニュー） | 実績／てんせい／サウンドON-OFF／タイトルへ戻る。開いている間は一時停止 |

---

## 画面レイアウト（縦画面固定）

```
┌────────────────────────────┐
│ HH:MM N日目      なまえ ○○  │ ← 上部: 左に時計/日数, 右に名前/体重 + ≡
│                  体重 N.Nkg ≡│
│                            │
│         [ 生物の絵 ]       │ ← Phaser キャンバス（壁色+タイル床の背景）
│        ぼーっとしている...   │   中央配置、呼吸/揺れモーション
│                            │
│ ┌────────┐┌────────┐┌──────┐│ ← 下部セーフゾーン (pb-16)
│ │ ごはん ││  ねる  ││あそぶ ││
│ └────────┘└────────┘└──────┘│
└────────────────────────────┘
```

アクションモード時は上下のステータス/ボタンをフェードし、左上に「もどる」を表示。
横画面レイアウトはサポートしない（縦のみ）。

---

## アーキテクチャ

```
┌─────────────────────────────────┐
│         React (HTML/CSS)        │  ← タイトル/ステータス/ボタン/モーダル
│  App.tsx, TitleScreen,          │
│  HamburgerMenu, *Dialog/Toast   │
└────────────┬────────────────────┘
             │ useGameStore()      sound（WebAudio）
             ↓
┌─────────────────────────────────┐
│       Zustand Store (+persist)  │
│  gameStore.ts                   │  food/days/weight/name/mode/...
└────────────┬────────────────────┘
             │ getState()
             ↓
┌─────────────────────────────────┐
│       Phaser 3 (Canvas)         │
│  MainScene  … 育成（生物の描画）  │
│  ActionScene … 横スクロール       │
└─────────────────────────────────┘

純粋ロジックは React/Phaser から切り出してテスト: achievements.ts / reincarnation.ts /
audio/sound.ts（noteToFreq 等）/ gameStore の stageOf。効果音・BGM は sound シングルトン。
```

---

## ファイル構成

```
public/
└── assets/
    ├── creature_1_baby_stop.png  主人公（128x128・白・透過）
    ├── food_apple.png            アクションのごはん（りんご）
    ├── ground_surface.png        アクション地面の表面（草）
    ├── ground_body.png           アクション地面の本体（土）
    ├── floor_tile.png            育成画面の床タイル
    └── stars.png                 アクション夜テーマの星

src/
├── main.tsx                      エントリポイント
├── App.tsx                       縦レイアウト全体・育成ボタン・BGM/SE 配線
├── index.css                     Tailwind + ピクセルフォント変数
│
├── store/
│   └── gameStore.ts              Zustand ストア（persist 付き）。stageOf/stageNoOf も
│
├── achievements.ts               実績定義・解除判定（findNewlyUnlocked）
├── reincarnation.ts              転生ロジック（canReincarnate / reincarnatedFields）
├── audio/
│   ├── sound.ts                  WebAudio チップチューン（SE / BGM care|action / ミュート）
│   └── sound.test.ts
├── reincarnation.test.ts / growth.test.ts  ユニットテスト（vitest, 計20件）
│
├── game/scenes/
│   ├── MainScene.ts              育成画面（生物の描画・モーション・床背景）
│   └── ActionScene.ts            横スクロール（地面/ごはん/背景テーマ/物理）
│
└── components/
    ├── GameCanvas.tsx            Phaser.Game の React ラッパー
    ├── TitleScreen.tsx           タイトル（はじめる/つづける）
    ├── NameInputModal.tsx        名前入力
    ├── HamburgerMenu.tsx         メニュー（実績/転生/サウンド/タイトルへ）
    ├── AchievementsDialog.tsx    実績一覧
    └── AchievementToast.tsx      実績解除トースト
```

> 旧 UI（`StatusBar`/`ActionBar`/`GameUI`/`ui/*`）と `EventBus` は削除済み。`tsconfig` は
> `noUnusedLocals/Parameters: false`（Phaser の `update(time, delta)` 等の未使用引数を許容）。

---

## スプライト仕様

- **サイズ**: 128px × 128px（PNG）
- **論理ドット**: 1ドット = 2px（実質 64×64 グリッド）
- **色**: 白（透過背景）
- **表示倍率**: 体重に比例（`weight * 0.1`）。初期体重 5kg → 0.5倍、10kg → 1.0倍 …と成長で大きくなる
- **命名規則**: `creature_<stage>_<form>_<motion>.png`（`<stage>`=1,2,3… / `<form>`=baby,child,adult / `<motion>`=stop,walk…）
- **現状**: 主人公は `creature_1_baby_stop.png` のみ。成長はスケール拡大で表現（ステージ別の絵は持たない方針）

アクション用アセット（地面・ごはん・床・星）も同じく小パレットのドット絵（透過・AAなし）。
Phaser の `pixelArt: true` + 整数倍スケールでアンチエイリアスなしを保つ。

---

## フォント

CSS 変数 `--pixel-jp` に `'DotGothic16', 'Press Start 2P', monospace` を設定。`App.tsx` 全体に適用。

- 英数字 → Press Start 2P
- 日本語 → DotGothic16（フォールバック）

両フォントとも Google Fonts でロード（`index.html`）。

---

## 開発上のメモ

### Phaser キャンバスのサイズ
`GameCanvas.tsx` のコンテナは `absolute inset-0`。flex 親内で `w-full h-full` を使うと Phaser の RESIZE モードと相互作用して canvas 高さが暴走（過去事例: 2686px に膨張）するため、絶対配置で親の境界に固定する。

### Zustand の Phaser 側からの参照
`useGameStore.getState()` は React フックではないため、Phaser の `update()` から毎フレーム呼んでも安全。状態書き込みは `useGameStore.setState({...})` または store 内のアクションで行う。

### アクションの当たり判定（ActionScene）
「足場の上を走り、穴に落ちたら育成へ戻る」だけのシンプル設計（側面衝突は意図的に廃止）。
地面は表面（草）と本体（土）の2スプライト＝土がコライダー、草は同速スクロールの装飾。
背景は `BG_THEMES`（昼/夕/夜）から入場ごとにランダム。preview(WebGL)はスクショが不安定で目視検証しづらい。

### 音（audio/sound.ts）
MIDI はブラウザ非対応のため WebAudio で自前合成。BGM は専用ゲインに通し、停止時にノードごと
フェード切断するので曲の切替が即時（育成↔アクションで重ならない）。`docs/bgm_seed.mid` は DAW 用シード。

---

## 状況・ロードマップ

完了: ごはん/ねる配線・体重/日数の自動進行・成長ステージ判定・セーブ(LocalStorage)・タイトル・
実績・転生・アクションモード・BGM/SE・アクションの絵（地面/ごはん/背景）。テスト 20/20。
詳細は `PROJECT_STATUS.md` を参照（git を正とする）。

今後の任意ポリッシュ:
- 動きフレーム（`*_walk_*` などのアニメ）
- 状態異常（空腹・眠気）の表現
- アクションのスコア/結果の還元・目標設定
