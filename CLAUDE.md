# DogWalk リポジトリ — オリジナル生物育成ゲーム

> プロジェクト名は歴史的経緯で `DogWalk` のままだが、ゲーム内容は **オリジナル生物の育成** に変更された。

## ゲームコンセプト

プレイヤーは画面中央のオリジナル生物を **ごはん** と **ねる** で世話する。目的は **生物をどんどん成長させていくこと**。たまごっち風の縦画面ワンレイアウト。

成長ステージ（予定）：
- ベビー（`creature_1_baby_*.png`）
- 以降のステージは未定（`creature_2_*`, `creature_3_*` 等を追加していく想定）

各ステージで「停止」「動いている」などのスプライト差分を持つ（命名規則：`creature_<stage>_<form>_<motion>.png`）。

---

## 現在のステータス指標

| 指標 | 内部キー | 説明 |
|---|---|---|
| ごはん残数 | `food` | プレイヤーが与えられる回数 |
| 経過日数 | `days` | ゲーム内日数（成長に紐づく予定） |
| 体重 | `weight` | 成長度の数値表現 (kg) |

`src/store/gameStore.ts` に Zustand で保持。

---

## 操作

| ボタン | 効果（実装予定） |
|---|---|
| ごはん | 食事を与える（ごはん残数 -1、体重増） |
| ねる | 寝かせる（時間経過・成長促進） |

**※現状は両ボタンとも見た目だけで未配線。**

---

## 画面レイアウト（縦画面固定）

```
┌────────────────────────────┐
│              ごはん     N  │ ← 上部セーフゾーン (pt-16)
│              経過日数   N  │   右寄せのラベル＝値表
│              体重     N.Nkg│
│                            │
│                            │
│         [ 生物の絵 ]       │ ← Phaser キャンバス
│                            │   中央配置、軽く上下に揺れ
│                            │
│                            │
│  ┌──────────┐ ┌──────────┐ │ ← 下部セーフゾーン (pb-16)
│  │  ごはん  │ │   ねる   │ │
│  └──────────┘ └──────────┘ │
└────────────────────────────┘
```

横画面レイアウトはサポートしない（縦のみ）。

---

## アーキテクチャ

```
┌─────────────────────────────────┐
│         React (HTML/CSS)        │  ← 上部ステータス + 下部ボタン
│  App.tsx                        │
└────────────┬────────────────────┘
             │ useGameStore()
             ↓
┌─────────────────────────────────┐
│       Zustand Store             │
│  gameStore.ts                   │
│   food / days / weight          │
└────────────┬────────────────────┘
             │ getState()
             ↓
┌─────────────────────────────────┐
│       Phaser 3 (Canvas)         │  ← 生物の表示・アニメ
│  MainScene.ts                   │
│   preload() で PNG ロード        │
│   update() でゆらゆら描画        │
└─────────────────────────────────┘
```

---

## ファイル構成

```
public/
└── assets/
    └── creature_1_baby_stop.png  ← 128x128 ピクセルアート（白）

src/
├── main.tsx                      エントリポイント
├── App.tsx                       縦レイアウト全体（上ステータス + 中央キャンバス + 下ボタン）
├── index.css                     Tailwind + ピクセルフォント変数
│
├── store/
│   └── gameStore.ts              Zustand ストア（food / days / weight）
│
├── game/
│   ├── EventBus.ts               React↔Phaser 用 EventEmitter（現状未使用、復活想定で残置）
│   └── scenes/
│       └── MainScene.ts          生物スプライトの読み込み・描画
│
└── components/
    ├── GameCanvas.tsx            Phaser.Game の React ラッパー
    ├── StatusBar.tsx             （旧UI、未使用）
    ├── ActionBar.tsx             （旧UI、未使用）
    ├── GameUI.tsx                （旧UI、未使用）
    └── ui/                       （旧shadcn風コンポーネント、未使用）
```

旧 UI コンポーネント（`StatusBar` / `ActionBar` / `GameUI` / `ui/*`）は犬散歩ゲーム時代の残骸で、現在は `App.tsx` から参照されていない。再利用しない場合は削除可能。

---

## スプライト仕様

- **サイズ**: 128px × 128px（PNG）
- **論理ドット**: 1ドット = 2px（実質 64×64 グリッド）
- **色**: 白（透過背景）
- **表示倍率**: 体重に比例（`weight * 0.1`）。初期体重 5kg → 0.5倍、10kg → 1.0倍 …と成長で大きくなる
- **命名**: `creature_<stage>_<form>_<motion>.png`
  - `<stage>`: 数字 1, 2, 3...（成長段階）
  - `<form>`: `baby` / `adult` など
  - `<motion>`: `stop` / `walk` など

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

### 旧コードの扱い
`gameStore.ts` の旧フィールド（stamina, motivation, distance, dogState, etc.）はすべて削除済み。`EventBus` と旧コンポーネントは残置しているが、新コンセプトに合わせて作り直す前提。

---

## 今後のロードマップ（メモ）

- ごはん/ねる ボタンの実装（state 更新）
- 体重・日数の自動進行ロジック
- 成長ステージごとのスプライト切替（baby → 次の段階）
- 動きフレーム（`*_walk_*` などのアニメ）
- 状態異常（空腹・眠気）の表現
- セーブ（LocalStorage）
- BGM/SE
