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

// デバッグ描画（キャラ枠・足元マーカー・セグメント枠・地面ライン）。一時的にONで確認用。
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

    // キャラの足元に地面があるか。
    // 片足でも地面の上にあれば「地面あり」（= 両足とも地面外のときだけ落下）。
    private hasGroundBelow(): boolean {
        const halfW = this.creature.displayWidth * 0.5;
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
        const halfW = this.creature.displayWidth * 0.5;
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
        const halfW = cw * 0.5;

        // 地面ライン
        g.lineStyle(1, 0x00ffff, 0.6);
        g.beginPath();
        g.moveTo(0, this.groundY);
        g.lineTo(this.scale.width, this.groundY);
        g.strokePath();

        // セグメント枠
        g.lineStyle(1, 0xffff00, 0.9);
        for (const s of this.segments) {
            g.strokeRect(s.rect.x, s.rect.y, s.width, s.rect.height);
        }

        // キャラの bounding box（緑）
        g.lineStyle(2, 0x00ff00, 1);
        g.strokeRect(cx - halfW, cy - ch, cw, ch);

        // 足元マーカー（赤・左右）
        g.fillStyle(0xff0000, 1);
        g.fillCircle(cx - halfW, cy, 4);
        g.fillCircle(cx + halfW, cy, 4);
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
