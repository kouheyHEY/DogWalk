import Phaser from "phaser";
import { useGameStore } from "../../store/gameStore";

const SCALE_PER_KG = 0.1; // MainScene と同じ基準

const GRAVITY = 0.004; // 重力加速度 (px / ms^2)
const SCROLL_SPEED = 0.25; // 前進スクロール速度 (px / ms = 250px/s)
const GROUND_RATIO = 0.8; // 地面の高さ（画面高に対する割合）

// 地面セグメントとギャップの幅レンジ
const SEG_MIN_WIDTH = 200;
const SEG_MAX_WIDTH = 380;
const GAP_MIN_WIDTH = 90;
const GAP_MAX_WIDTH = 170;

const FALL_EXIT_MARGIN = 80; // 画面下からこの距離より下に落ちたら育成画面へ戻る

const MAX_CHARGE_MS = 800; // フルチャージまでの押下時間
const JUMP_MIN = 0.9; // 最小ジャンプ初速 (px / ms)
const JUMP_MAX = 1.6; // 最大ジャンプ初速 (px / ms)

// 体重による鈍化（でかいほど遅い/低い）。基準体重で 1.0、1kg ごとに係数が下がり、下限でクランプ。
const WEIGHT_BASE = 5; // 基準体重 (kg)
const SPEED_PER_KG = 0.02; // 前進速度の 1kg あたり鈍化
const SPEED_FACTOR_MIN = 0.5;
const JUMP_PER_KG = 0.01; // ジャンプ力の 1kg あたり鈍化（控えめ）
const JUMP_FACTOR_MIN = 0.6;

// キャラの当たり判定幅 / displayWidth の比率。
// PNG (128x128) には透明余白があり、見た目のキャラよりほんの少しだけ狭くなるように調整する。
const COLLISION_WIDTH_RATIO = 0.4;

// ごはん（取得アイテム）の設定。仮素材として白い小四角を出す。
const FOOD_SIZE = 14;
const FOOD_MIN_INTERVAL_MS = 1500;
const FOOD_MAX_INTERVAL_MS = 3500;
const FOOD_MIN_HEIGHT_ABOVE_GROUND = 8; // 地面から最低この高さに出る
const FOOD_MAX_HEIGHT_ABOVE_GROUND = 130; // ジャンプで届く範囲に収めた高さ

// デバッグ描画（スプライト枠・当たり判定・足元マーカー・セグメント枠・地面ライン）。一時的にONで確認用。
const DEBUG = true;

interface GroundSegment {
    rect: Phaser.GameObjects.Rectangle;
    width: number;
}

function rand(min: number, max: number) {
    return min + Math.random() * (max - min);
}

// 横スクロールアクション用シーン。
// タップした瞬間からチャージが始まり、離すとジャンプ（チャージ量でジャンプ力可変）。
// 床は塊として描画され、キャラ幅を考慮した落下判定と、塊側面への衝突判定を行う。
export class ActionScene extends Phaser.Scene {
    private creature!: Phaser.GameObjects.Image;
    private label!: Phaser.GameObjects.Text;
    private groundY = 0;
    private creatureVY = 0; // 垂直速度 (px / ms)
    private baseScale = 0.5;
    private segments: GroundSegment[] = [];
    private foods: Phaser.GameObjects.Rectangle[] = [];
    private nextFoodSpawnAt = 0;
    private pointerDownAt: number | null = null;
    private debugGfx?: Phaser.GameObjects.Graphics;

    constructor() {
        super({ key: "ActionScene" });
    }

    preload() {
        this.load.image("creature", "assets/creature_1_baby_stop.png");
    }

    create() {
        this.cameras.main.setBackgroundColor("#101820");
        this.creatureVY = 0;
        this.pointerDownAt = null;
        this.segments = [];
        this.foods = [];
        this.nextFoodSpawnAt = 0; // 初回スポーン時刻は layout 後に設定する

        // キャラ（地面に立つ。原点は最下中央）
        const { weight } = useGameStore.getState();
        this.baseScale = weight * SCALE_PER_KG;
        this.creature = this.add
            .image(0, 0, "creature")
            .setOrigin(0.5, 1.0)
            .setScale(this.baseScale);

        // WIP ラベル
        this.label = this.add
            .text(0, 0, "ACTION (WIP)", {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: "16px",
                color: "#ffffff",
            })
            .setOrigin(0.5, 0.5);

        if (DEBUG) {
            this.debugGfx = this.add.graphics().setDepth(1000);
        }

        this.layout();
        this.nextFoodSpawnAt =
            this.time.now + rand(FOOD_MIN_INTERVAL_MS, FOOD_MAX_INTERVAL_MS);
        this.scale.on("resize", this.layout, this);

        // 入力: 押下中チャージ → 離すとジャンプ
        this.input.on("pointerdown", this.onPointerDown, this);
        this.input.on("pointerup", this.onPointerUp, this);

        this.events.once("shutdown", () => {
            this.scale.off("resize", this.layout, this);
            this.input.off("pointerdown", this.onPointerDown, this);
            this.input.off("pointerup", this.onPointerUp, this);
        });
    }

    private onPointerDown() {
        this.pointerDownAt = this.time.now;
    }

    private onPointerUp() {
        if (this.pointerDownAt === null) return;
        const holdMs = this.time.now - this.pointerDownAt;
        this.pointerDownAt = null;
        if (useGameStore.getState().isPaused) return;
        this.jump(holdMs);
    }

    // 当たり判定の半幅（見た目のキャラよりほんの少しだけ狭い）。
    private collisionHalfWidth(): number {
        return this.creature.displayWidth * COLLISION_WIDTH_RATIO * 0.5;
    }

    // キャラの足元に地面があるか。
    // 片足でも地面の上にあれば「地面あり」（= 両足とも地面外のときだけ落下）。
    private hasGroundBelow(): boolean {
        const halfW = this.collisionHalfWidth();
        const left = this.creature.x - halfW;
        const right = this.creature.x + halfW;
        const isOver = (x: number) =>
            this.segments.some(
                (s) => x >= s.rect.x && x <= s.rect.x + s.width,
            );
        return isOver(left) || isOver(right);
    }

    // 落下中に塊の側面に重なっていたら、塊の左外側にキャラを押し出す。
    // ゲームオーバーにはせず、塊が左へ流れるのに合わせて引きずられる挙動になる。
    private resolveSideCollision() {
        if (this.creature.y <= this.groundY) return;
        const halfW = this.collisionHalfWidth();
        for (const s of this.segments) {
            const segLeft = s.rect.x;
            const segRight = s.rect.x + s.width;
            if (
                segLeft < this.creature.x + halfW &&
                segRight > this.creature.x - halfW
            ) {
                this.creature.x = segLeft - halfW;
            }
        }
    }

    private isOnGround() {
        return (
            this.creature.y >= this.groundY - 0.5 &&
            this.creature.y <= this.groundY + 0.5 &&
            this.hasGroundBelow()
        );
    }

    // 体重に応じた鈍化係数（基準=1.0、重いほど小さく、下限でクランプ）。
    private weightFactor(perKg: number, min: number) {
        const { weight } = useGameStore.getState();
        return Phaser.Math.Clamp(1 - (weight - WEIGHT_BASE) * perKg, min, 1);
    }

    private jump(holdMs: number) {
        if (!this.isOnGround()) return;
        const ratio = Phaser.Math.Clamp(holdMs / MAX_CHARGE_MS, 0, 1);
        const base = JUMP_MIN + ratio * (JUMP_MAX - JUMP_MIN);
        // 重いほどジャンプは低くなる
        this.creatureVY = -(base * this.weightFactor(JUMP_PER_KG, JUMP_FACTOR_MIN));
    }

    // 初期セグメントを画面右端まで埋める。
    private fillSegmentsRight() {
        const w = this.scale.width;
        const segHeight = this.scale.height - this.groundY;
        let nextX = 0;
        if (this.segments.length > 0) {
            const last = this.segments[this.segments.length - 1];
            nextX = last.rect.x + last.width + rand(GAP_MIN_WIDTH, GAP_MAX_WIDTH);
        }
        while (nextX < w + SEG_MAX_WIDTH) {
            const width = rand(SEG_MIN_WIDTH, SEG_MAX_WIDTH);
            // 地面は groundY 上端〜画面下端の塊。半透明白で背景から浮き上がらせる
            const rect = this.add
                .rectangle(nextX, this.groundY, width, segHeight, 0xffffff, 0.45)
                .setOrigin(0, 0);
            this.segments.push({ rect, width });
            nextX += width + rand(GAP_MIN_WIDTH, GAP_MAX_WIDTH);
        }
    }

    // ごはんを画面右端の少し外に出現させる。y は地面より上のジャンプで届く範囲でランダム。
    private spawnFood() {
        const heightAbove = rand(
            FOOD_MIN_HEIGHT_ABOVE_GROUND,
            FOOD_MAX_HEIGHT_ABOVE_GROUND,
        );
        const x = this.scale.width + 20;
        // origin (0, 0) なので rect.y は上端
        const y = this.groundY - heightAbove - FOOD_SIZE;
        const f = this.add
            .rectangle(x, y, FOOD_SIZE, FOOD_SIZE, 0xffffff, 1)
            .setOrigin(0, 0);
        this.foods.push(f);
    }

    // 全ごはんを左へスクロール、画面外に出たものは破棄。
    private scrollFoods(dx: number) {
        for (const f of this.foods) {
            f.x -= dx;
        }
        this.foods = this.foods.filter((f) => {
            if (f.x + FOOD_SIZE < 0) {
                f.destroy();
                return false;
            }
            return true;
        });
    }

    // キャラの当たり判定とごはんの AABB が重なれば取得して破棄。
    private checkFoodCollisions() {
        const halfW = this.collisionHalfWidth();
        const cLeft = this.creature.x - halfW;
        const cRight = this.creature.x + halfW;
        const cBottom = this.creature.y;
        const cTop = this.creature.y - this.creature.displayHeight;

        this.foods = this.foods.filter((f) => {
            const fLeft = f.x;
            const fRight = f.x + FOOD_SIZE;
            const fTop = f.y;
            const fBottom = f.y + FOOD_SIZE;
            if (
                cLeft < fRight &&
                cRight > fLeft &&
                cTop < fBottom &&
                cBottom > fTop
            ) {
                f.destroy();
                useGameStore.getState().gainFood();
                return false;
            }
            return true;
        });
    }

    // 左へスクロールし、画面外に出たセグメントは右に再配置する。
    private scrollSegments(dx: number) {
        for (const s of this.segments) {
            s.rect.x -= dx;
        }
        const segHeight = this.scale.height - this.groundY;
        while (
            this.segments.length > 0 &&
            this.segments[0].rect.x + this.segments[0].width < 0
        ) {
            const s = this.segments.shift()!;
            const last = this.segments[this.segments.length - 1];
            const newX =
                (last ? last.rect.x + last.width : 0) +
                rand(GAP_MIN_WIDTH, GAP_MAX_WIDTH);
            const newWidth = rand(SEG_MIN_WIDTH, SEG_MAX_WIDTH);
            s.rect.x = newX;
            s.rect.setSize(newWidth, segHeight);
            s.width = newWidth;
            this.segments.push(s);
        }
    }

    // 現在のキャンバスサイズに合わせて各要素を再配置する。
    private layout() {
        const w = this.scale.width;
        const h = this.scale.height;
        this.groundY = h * GROUND_RATIO;

        // 全セグメントの y と高さを地面に合わせる
        const segHeight = h - this.groundY;
        for (const s of this.segments) {
            s.rect.y = this.groundY;
            s.rect.setSize(s.width, segHeight);
        }

        // 右側のカバレッジを確保（初期化 or 画面が広がった場合）
        this.fillSegmentsRight();

        this.creature.x = w * 0.25;
        if (this.creatureVY === 0) {
            this.creature.y = this.groundY;
        }

        this.label.setPosition(w / 2, h * 0.35);
    }

    update(_time: number, delta: number) {
        if (useGameStore.getState().isPaused) return;

        // 地面セグメントを左へスクロール（体重で速度が鈍化）
        const dx =
            SCROLL_SPEED *
            this.weightFactor(SPEED_PER_KG, SPEED_FACTOR_MIN) *
            delta;
        this.scrollSegments(dx);

        // ごはんのスポーン＆スクロール
        if (this.time.now >= this.nextFoodSpawnAt) {
            this.spawnFood();
            this.nextFoodSpawnAt =
                this.time.now +
                rand(FOOD_MIN_INTERVAL_MS, FOOD_MAX_INTERVAL_MS);
        }
        this.scrollFoods(dx);

        // 簡易重力と着地
        this.creatureVY += GRAVITY * delta;
        const prevY = this.creature.y;
        let y = prevY + this.creatureVY * delta;
        // 一度地面より下に落ちたあとは、地面下から上方向へクランプしない
        if (
            prevY <= this.groundY + 0.001 &&
            this.hasGroundBelow() &&
            y >= this.groundY &&
            this.creatureVY >= 0
        ) {
            y = this.groundY;
            this.creatureVY = 0;
        }
        this.creature.y = y;

        // 塊側面へ重なっていたら、塊の左外側に押し出す（ゲームオーバーにはしない）
        this.resolveSideCollision();

        // ごはんとの当たり判定
        this.checkFoodCollisions();

        // 画面下を一定量超えたら育成画面へ自動復帰（= ゲームオーバー）
        if (this.creature.y > this.scale.height + FALL_EXIT_MARGIN) {
            useGameStore.getState().exitAction();
            return;
        }

        // チャージ中の潰し演出（タップした瞬間から増えていく）
        this.applyChargeSquash();

        if (DEBUG) this.drawDebug();
    }

    private drawDebug() {
        if (!this.debugGfx) return;
        const g = this.debugGfx;
        g.clear();

        const cx = this.creature.x;
        const cy = this.creature.y;
        const cw = this.creature.displayWidth;
        const ch = this.creature.displayHeight;
        const spriteHalfW = cw * 0.5;
        const collisionHalfW = this.collisionHalfWidth();

        // 地面ライン（シアン）
        g.lineStyle(1, 0x00ffff, 0.5);
        g.beginPath();
        g.moveTo(0, this.groundY);
        g.lineTo(this.scale.width, this.groundY);
        g.strokePath();

        // セグメント枠（黄）
        g.lineStyle(1, 0xffff00, 0.9);
        for (const s of this.segments) {
            g.strokeRect(s.rect.x, s.rect.y, s.width, s.rect.height);
        }

        // ごはん枠（オレンジ）
        g.lineStyle(1, 0xff8800, 1);
        for (const f of this.foods) {
            g.strokeRect(f.x, f.y, FOOD_SIZE, FOOD_SIZE);
        }

        // スプライト全体の枠（緑、透明余白込み）
        g.lineStyle(2, 0x00ff00, 0.8);
        g.strokeRect(cx - spriteHalfW, cy - ch, cw, ch);

        // 当たり判定の枠（シアン、見た目キャラよりわずかに狭い）
        g.lineStyle(2, 0x00ffff, 1);
        g.strokeRect(cx - collisionHalfW, cy - ch, collisionHalfW * 2, ch);

        // 足元マーカー（赤・当たり判定の左右端 = 落下判定の基準点）
        g.fillStyle(0xff0000, 1);
        g.fillCircle(cx - collisionHalfW, cy, 4);
        g.fillCircle(cx + collisionHalfW, cy, 4);
        // 中心点（マゼンタ）
        g.fillStyle(0xff00ff, 1);
        g.fillCircle(cx, cy, 3);
    }

    private applyChargeSquash() {
        if (this.pointerDownAt !== null && this.isOnGround()) {
            const holdMs = this.time.now - this.pointerDownAt;
            const ratio = Phaser.Math.Clamp(holdMs / MAX_CHARGE_MS, 0, 1);
            this.creature.setScale(
                this.baseScale * (1 + 0.12 * ratio),
                this.baseScale * (1 - 0.18 * ratio),
            );
        } else {
            this.creature.setScale(this.baseScale);
        }
    }
}
