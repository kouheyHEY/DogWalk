import Phaser from "phaser";
import { useGameStore } from "../../store/gameStore";

const SCALE_PER_KG = 0.1; // MainScene と同じ基準

const GRAVITY = 0.004; // 重力加速度 (px / ms^2)
const SCROLL_SPEED = 0.25; // 前進スクロール速度 (px / ms = 250px/s)
const DASH_SPACING = 64; // 地面破線の間隔
const DASH_WIDTH = 28; // 地面破線の長さ
const GROUND_RATIO = 0.8; // 地面の高さ（画面高に対する割合）

const TAP_THRESHOLD_MS = 180; // これ未満の押下は突進、以上はジャンプ
const MAX_CHARGE_MS = 800; // フルチャージまでの押下時間
const JUMP_MIN = 0.9; // 最小ジャンプ初速 (px / ms)
const JUMP_MAX = 1.6; // 最大ジャンプ初速 (px / ms)
const DASH_DISTANCE = 200; // 突進の前方移動量 (px)
const DASH_OUT_MS = 960; // 突進の前進にかける時間（線形・遅め）
const DASH_BACK_MS = 1280; // 突進の復帰にかける時間（線形・さらに遅め）

// 体重による鈍化（でかいほど遅い/低い）。基準体重で 1.0、1kg ごとに係数が下がり、下限でクランプ。
// ※将来実装予定の「突進の威力」などは逆に強化される想定（今回は未対応）。
const WEIGHT_BASE = 5; // 基準体重 (kg)
const SPEED_PER_KG = 0.02; // 前進速度の 1kg あたり鈍化
const SPEED_FACTOR_MIN = 0.5;
const JUMP_PER_KG = 0.01; // ジャンプ力の 1kg あたり鈍化（控えめ）
const JUMP_FACTOR_MIN = 0.6;
const DASH_PER_KG = 0.02; // 突進の 1kg あたり鈍化（所要時間が伸びる）
const DASH_FACTOR_MIN = 0.5;

// 横スクロールアクション用シーン。
// Step 3: 短押し突進 / 長押しチャージ→ジャンプ（チャージ量でジャンプ力可変）。
export class ActionScene extends Phaser.Scene {
    private creature!: Phaser.GameObjects.Image;
    private groundLine!: Phaser.GameObjects.Graphics;
    private label!: Phaser.GameObjects.Text;
    private groundY = 0;
    private creatureVY = 0; // 垂直速度 (px / ms)
    private baseScale = 0.5;
    private dashes: Phaser.GameObjects.Rectangle[] = [];
    private pointerDownAt: number | null = null;
    private dashing = false;

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
        this.dashing = false;

        const w = this.scale.width;

        // 地面ライン（位置は layout() で確定）
        this.groundLine = this.add.graphics();

        // 前進を表す地面の破線（左へスクロール）
        this.dashes = [];
        const count = Math.ceil(w / DASH_SPACING) + 1;
        for (let i = 0; i < count; i++) {
            const d = this.add
                .rectangle(i * DASH_SPACING, 0, DASH_WIDTH, 3, 0xffffff, 0.4)
                .setOrigin(0, 0.5);
            this.dashes.push(d);
        }

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

        this.layout();
        this.scale.on("resize", this.layout, this);

        // 入力: 押下時間でジャンプ/突進を分岐
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
        if (holdMs < TAP_THRESHOLD_MS) {
            this.dash();
        } else {
            this.jump(holdMs);
        }
    }

    private isOnGround() {
        return this.creature.y >= this.groundY - 0.5;
    }

    // 体重に応じた鈍化係数（基準=1.0、重いほど小さく、下限でクランプ）。
    private weightFactor(perKg: number, min: number) {
        const { weight } = useGameStore.getState();
        return Phaser.Math.Clamp(1 - (weight - WEIGHT_BASE) * perKg, min, 1);
    }

    private jump(holdMs: number) {
        if (!this.isOnGround()) return;
        const ratio = Phaser.Math.Clamp(
            (holdMs - TAP_THRESHOLD_MS) / (MAX_CHARGE_MS - TAP_THRESHOLD_MS),
            0,
            1,
        );
        const base = JUMP_MIN + ratio * (JUMP_MAX - JUMP_MIN);
        // 重いほどジャンプは低くなる
        this.creatureVY = -(base * this.weightFactor(JUMP_PER_KG, JUMP_FACTOR_MIN));
    }

    private dash() {
        if (this.dashing) return;
        this.dashing = true;
        const baseX = this.scale.width * 0.25;
        // キャラが画面外へ出ないよう右端でクランプ
        const maxX = this.scale.width - this.creature.displayWidth * 0.5 - 8;
        const targetX = Math.min(baseX + DASH_DISTANCE, maxX);
        // 重いほど突進が遅くなる（所要時間が伸びる）
        const slow = this.weightFactor(DASH_PER_KG, DASH_FACTOR_MIN);
        this.tweens.add({
            targets: this.creature,
            x: targetX,
            duration: DASH_OUT_MS / slow,
            ease: "Linear",
            onComplete: () => {
                this.tweens.add({
                    targets: this.creature,
                    x: baseX,
                    duration: DASH_BACK_MS / slow,
                    ease: "Linear",
                    onComplete: () => {
                        this.dashing = false;
                        this.creature.x = baseX;
                    },
                });
            },
        });
    }

    // 現在のキャンバスサイズに合わせて各要素を再配置する。
    private layout() {
        const w = this.scale.width;
        const h = this.scale.height;
        this.groundY = h * GROUND_RATIO;

        this.groundLine.clear();
        this.groundLine.lineStyle(2, 0xffffff, 0.6);
        this.groundLine.beginPath();
        this.groundLine.moveTo(0, this.groundY);
        this.groundLine.lineTo(w, this.groundY);
        this.groundLine.strokePath();

        for (const d of this.dashes) {
            d.y = this.groundY + 8;
        }

        // 突進中は x をツイードに任せる
        if (!this.dashing) {
            this.creature.x = w * 0.25;
        }
        // 着地中（落下していない）ときだけ地面に合わせる。ジャンプ中は重力で着地させる。
        if (this.creatureVY === 0) {
            this.creature.y = this.groundY;
        }

        this.label.setPosition(w / 2, h * 0.35);
    }

    update(_time: number, delta: number) {
        if (useGameStore.getState().isPaused) return;

        // 破線を左へスクロールして前進を表現（体重で速度が鈍化）
        const dx = SCROLL_SPEED * this.weightFactor(SPEED_PER_KG, SPEED_FACTOR_MIN) * delta;
        const total = this.dashes.length * DASH_SPACING;
        for (const d of this.dashes) {
            d.x -= dx;
            if (d.x < -DASH_WIDTH) d.x += total;
        }

        // 簡易重力と着地
        this.creatureVY += GRAVITY * delta;
        let y = this.creature.y + this.creatureVY * delta;
        if (y >= this.groundY) {
            y = this.groundY;
            this.creatureVY = 0;
        }
        this.creature.y = y;

        // チャージ中の潰し演出（地面にいるときのみ）
        this.applyChargeSquash();
    }

    private applyChargeSquash() {
        if (this.pointerDownAt !== null && this.isOnGround()) {
            const holdMs = this.time.now - this.pointerDownAt;
            const ratio = Phaser.Math.Clamp(
                (holdMs - TAP_THRESHOLD_MS) /
                    (MAX_CHARGE_MS - TAP_THRESHOLD_MS),
                0,
                1,
            );
            this.creature.setScale(
                this.baseScale * (1 + 0.12 * ratio),
                this.baseScale * (1 - 0.18 * ratio),
            );
        } else {
            this.creature.setScale(this.baseScale);
        }
    }
}
