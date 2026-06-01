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

const AFTERIMAGE_INTERVAL_MS = 60; // 突進中に残像を出す間隔
const AFTERIMAGE_FADE_MS = 280; // 残像のフェード時間

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

interface GroundSegment {
    rect: Phaser.GameObjects.Rectangle;
    width: number;
}

function rand(min: number, max: number) {
    return min + Math.random() * (max - min);
}

// 横スクロールアクション用シーン。
// Step 1: 連続地面を「セグメント＋ギャップ」に置き換え（視覚のみ／落下判定はまだ無し）。
export class ActionScene extends Phaser.Scene {
    private creature!: Phaser.GameObjects.Image;
    private label!: Phaser.GameObjects.Text;
    private groundY = 0;
    private creatureVY = 0; // 垂直速度 (px / ms)
    private baseScale = 0.5;
    private segments: GroundSegment[] = [];
    private pointerDownAt: number | null = null;
    private dashing = false;
    private dashForward = false; // 突進の前進フェーズ中だけ true（残像はこの間だけ出す）
    private afterimageTimer = 0;

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
        this.dashForward = false;
        this.afterimageTimer = 0;
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

    // キャラの真下に地面セグメントが存在するか。
    private hasGroundBelow(): boolean {
        const cx = this.creature.x;
        for (const s of this.segments) {
            if (cx >= s.rect.x && cx <= s.rect.x + s.width) return true;
        }
        return false;
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
        this.dashForward = true;
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
                this.dashForward = false;
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

    private spawnAfterimage() {
        const ghost = this.add
            .image(this.creature.x, this.creature.y, "creature")
            .setOrigin(0.5, 1.0)
            .setScale(this.creature.scaleX, this.creature.scaleY)
            .setAlpha(0.45);
        this.tweens.add({
            targets: ghost,
            alpha: 0,
            duration: AFTERIMAGE_FADE_MS,
            onComplete: () => ghost.destroy(),
        });
    }

    // 初期セグメントを画面右端まで埋める。
    private fillSegmentsRight() {
        const w = this.scale.width;
        let nextX = 0;
        if (this.segments.length > 0) {
            const last = this.segments[this.segments.length - 1];
            nextX = last.rect.x + last.width + rand(GAP_MIN_WIDTH, GAP_MAX_WIDTH);
        }
        while (nextX < w + SEG_MAX_WIDTH) {
            const width = rand(SEG_MIN_WIDTH, SEG_MAX_WIDTH);
            const rect = this.add
                .rectangle(nextX, this.groundY, width, 2, 0xffffff, 0.6)
                .setOrigin(0, 0.5);
            this.segments.push({ rect, width });
            nextX += width + rand(GAP_MIN_WIDTH, GAP_MAX_WIDTH);
        }
    }

    // 左へスクロールし、画面外に出たセグメントは右に再配置する。
    private scrollSegments(dx: number) {
        for (const s of this.segments) {
            s.rect.x -= dx;
        }
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
            s.rect.setSize(newWidth, 2);
            s.width = newWidth;
            this.segments.push(s);
        }
    }

    // 現在のキャンバスサイズに合わせて各要素を再配置する。
    private layout() {
        const w = this.scale.width;
        const h = this.scale.height;
        this.groundY = h * GROUND_RATIO;

        // 全セグメントの y を地面に合わせる
        for (const s of this.segments) {
            s.rect.y = this.groundY;
        }

        // 右側のカバレッジを確保（初期化 or 画面が広がった場合）
        this.fillSegmentsRight();

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

        // 地面セグメントを左へスクロール（体重で速度が鈍化）
        const dx =
            SCROLL_SPEED *
            this.weightFactor(SPEED_PER_KG, SPEED_FACTOR_MIN) *
            delta;
        this.scrollSegments(dx);

        if (!this.dashing) {
            // 簡易重力と着地（真下にセグメントがあるときだけ着地、なければ落下し続ける）
            this.creatureVY += GRAVITY * delta;
            let y = this.creature.y + this.creatureVY * delta;
            if (
                this.hasGroundBelow() &&
                y >= this.groundY &&
                this.creatureVY >= 0
            ) {
                y = this.groundY;
                this.creatureVY = 0;
            }
            this.creature.y = y;
        } else {
            // 突進中は重力を無効化（y は据え置き）
            this.creatureVY = 0;
        }

        // 画面下を一定量超えたら育成画面へ自動復帰
        if (this.creature.y > this.scale.height + FALL_EXIT_MARGIN) {
            useGameStore.getState().exitAction();
            return;
        }

        // 突進の前進フェーズ中は残像を出す
        if (this.dashing && this.dashForward) {
            this.afterimageTimer += delta;
            while (this.afterimageTimer >= AFTERIMAGE_INTERVAL_MS) {
                this.afterimageTimer -= AFTERIMAGE_INTERVAL_MS;
                this.spawnAfterimage();
            }
        } else {
            this.afterimageTimer = 0;
        }

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
