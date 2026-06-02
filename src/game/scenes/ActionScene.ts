import Phaser from "phaser";
import { useGameStore } from "../../store/gameStore";

const SCALE_PER_KG = 0.1; // MainScene と同じ基準

// 物理は Arcade に統一。単位は px/s 系。
const GRAVITY_Y = 4000; // 重力加速度 (px/s²)
const SCROLL_SPEED = 250; // 前進スクロール速度 (px/s)
const JUMP_MIN = 900; // 最小ジャンプ初速 (px/s)
const JUMP_MAX = 1600; // 最大ジャンプ初速 (px/s)
const GROUND_RATIO = 0.8; // 地面の高さ（画面高に対する割合）

// 地面セグメントとギャップの幅レンジ
const SEG_MIN_WIDTH = 200;
const SEG_MAX_WIDTH = 380;
const GAP_MIN_WIDTH = 90;
const GAP_MAX_WIDTH = 170;

const FALL_EXIT_MARGIN = 80; // 画面下からこの距離より下に落ちたら育成画面へ戻る

const MAX_CHARGE_MS = 800; // フルチャージまでの押下時間

// 体重による鈍化（でかいほど遅い/低い）
const WEIGHT_BASE = 5;
const SPEED_PER_KG = 0.02;
const SPEED_FACTOR_MIN = 0.5;
const JUMP_PER_KG = 0.01;
const JUMP_FACTOR_MIN = 0.6;

// キャラの当たり判定幅 / displayWidth の比率（透明余白対策）
const COLLISION_WIDTH_RATIO = 0.4;

// ごはん
const FOOD_SIZE = 14;
const FOOD_MIN_INTERVAL_MS = 1500;
const FOOD_MAX_INTERVAL_MS = 3500;
const FOOD_MIN_HEIGHT_ABOVE_GROUND = 8;
const FOOD_MAX_HEIGHT_ABOVE_GROUND = 130;

// デバッグ描画
const DEBUG = true;

interface GroundSegment {
    rect: Phaser.GameObjects.Rectangle; // 物理静的ボディ付き
    width: number;
}

function rand(min: number, max: number) {
    return min + Math.random() * (max - min);
}

// 横スクロールアクション用シーン。
// キャラは物理ボディ（gravity + 衝突）、地面とごはんは静的ボディ（手動でスクロール）。
export class ActionScene extends Phaser.Scene {
    private creature!: Phaser.Physics.Arcade.Image;
    private label!: Phaser.GameObjects.Text;
    private groundY = 0;
    private baseScale = 0.5;
    private baseX = 0;
    private segments: GroundSegment[] = [];
    private segmentGroup!: Phaser.Physics.Arcade.StaticGroup;
    private foods: Phaser.GameObjects.Rectangle[] = [];
    private foodGroup!: Phaser.Physics.Arcade.StaticGroup;
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
        this.pointerDownAt = null;
        this.segments = [];
        this.foods = [];
        this.nextFoodSpawnAt = 0;

        // 重力をワールドに設定
        this.physics.world.gravity.y = GRAVITY_Y;

        const { weight } = useGameStore.getState();
        this.baseScale = weight * SCALE_PER_KG;

        // キャラ（物理ボディ付き）
        this.creature = this.physics.add
            .image(0, 0, "creature")
            .setOrigin(0.5, 1.0)
            .setScale(this.baseScale);
        const body = this.creature.body as Phaser.Physics.Arcade.Body;
        // 当たり判定はスプライト幅より狭く、画像の中央に配置
        body.setSize(
            this.creature.displayWidth * COLLISION_WIDTH_RATIO,
            this.creature.displayHeight,
            true,
        );

        // 地面セグメント・ごはん用の静的グループ
        this.segmentGroup = this.physics.add.staticGroup();
        this.foodGroup = this.physics.add.staticGroup();

        // 衝突応答（着地・側面押し出しを物理に任せる）
        this.physics.add.collider(this.creature, this.segmentGroup);
        // ごはんはオーバーラップで取得処理
        this.physics.add.overlap(
            this.creature,
            this.foodGroup,
            (_c, food) => {
                (food as Phaser.GameObjects.GameObject).destroy();
                useGameStore.getState().gainFood();
            },
        );

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

        // 入力
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

    private isOnGround(): boolean {
        const body = this.creature.body as Phaser.Physics.Arcade.Body;
        return body.blocked.down || body.touching.down;
    }

    private weightFactor(perKg: number, min: number) {
        const { weight } = useGameStore.getState();
        return Phaser.Math.Clamp(1 - (weight - WEIGHT_BASE) * perKg, min, 1);
    }

    private jump(holdMs: number) {
        if (!this.isOnGround()) return;
        const ratio = Phaser.Math.Clamp(holdMs / MAX_CHARGE_MS, 0, 1);
        const base = JUMP_MIN + ratio * (JUMP_MAX - JUMP_MIN);
        const v = base * this.weightFactor(JUMP_PER_KG, JUMP_FACTOR_MIN);
        (this.creature.body as Phaser.Physics.Arcade.Body).setVelocityY(-v);
    }

    // セグメントを 1 つ生成して segmentGroup に追加。
    private spawnSegment(x: number, width: number, segHeight: number) {
        const rect = this.add
            .rectangle(x, this.groundY, width, segHeight, 0xffffff, 0.45)
            .setOrigin(0, 0);
        this.segmentGroup.add(rect);
        const body = rect.body as Phaser.Physics.Arcade.StaticBody;
        body.setSize(width, segHeight);
        body.updateFromGameObject();
        return rect;
    }

    private fillSegmentsRight() {
        const w = this.scale.width;
        const segHeight = this.scale.height - this.groundY;
        let nextX = 0;
        if (this.segments.length > 0) {
            const last = this.segments[this.segments.length - 1];
            nextX =
                last.rect.x + last.width + rand(GAP_MIN_WIDTH, GAP_MAX_WIDTH);
        }
        while (nextX < w + SEG_MAX_WIDTH) {
            const width = rand(SEG_MIN_WIDTH, SEG_MAX_WIDTH);
            const rect = this.spawnSegment(nextX, width, segHeight);
            this.segments.push({ rect, width });
            nextX += width + rand(GAP_MIN_WIDTH, GAP_MAX_WIDTH);
        }
    }

    // 左へスクロール、画面外で右に再配置。静的ボディは updateFromGameObject で同期。
    private scrollSegments(dx: number) {
        const segHeight = this.scale.height - this.groundY;
        for (const s of this.segments) {
            s.rect.x -= dx;
            (s.rect.body as Phaser.Physics.Arcade.StaticBody)
                .updateFromGameObject();
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
            s.rect.setSize(newWidth, segHeight);
            s.width = newWidth;
            const body = s.rect.body as Phaser.Physics.Arcade.StaticBody;
            body.setSize(newWidth, segHeight);
            body.updateFromGameObject();
            this.segments.push(s);
        }
    }

    private spawnFood() {
        const heightAbove = rand(
            FOOD_MIN_HEIGHT_ABOVE_GROUND,
            FOOD_MAX_HEIGHT_ABOVE_GROUND,
        );
        const x = this.scale.width + 20;
        const y = this.groundY - heightAbove - FOOD_SIZE;
        const f = this.add
            .rectangle(x, y, FOOD_SIZE, FOOD_SIZE, 0xffffff, 1)
            .setOrigin(0, 0);
        this.foodGroup.add(f);
        const body = f.body as Phaser.Physics.Arcade.StaticBody;
        body.setSize(FOOD_SIZE, FOOD_SIZE);
        body.updateFromGameObject();
        this.foods.push(f);
    }

    private scrollFoods(dx: number) {
        for (const f of this.foods) {
            if (!f.active) continue;
            f.x -= dx;
            const body = f.body as Phaser.Physics.Arcade.StaticBody | null;
            if (body) body.updateFromGameObject();
        }
        // 取得済み（destroy 済み = !active）か、画面外左に出たものを除去
        this.foods = this.foods.filter((f) => {
            if (!f.active) return false;
            if (f.x + FOOD_SIZE < 0) {
                f.destroy();
                return false;
            }
            return true;
        });
    }

    private layout() {
        const w = this.scale.width;
        const h = this.scale.height;
        this.groundY = h * GROUND_RATIO;
        this.baseX = w * 0.25;

        const segHeight = h - this.groundY;
        for (const s of this.segments) {
            s.rect.y = this.groundY;
            s.rect.setSize(s.width, segHeight);
            const body = s.rect.body as Phaser.Physics.Arcade.StaticBody;
            body.setSize(s.width, segHeight);
            body.updateFromGameObject();
        }

        this.fillSegmentsRight();

        // 初期位置（まだ配置されていなければ地面の上に置く）
        const body = this.creature.body as Phaser.Physics.Arcade.Body;
        if (this.creature.x === 0 && this.creature.y === 0) {
            body.reset(this.baseX, this.groundY);
        }

        this.label.setPosition(w / 2, h * 0.35);
    }

    update(_time: number, delta: number) {
        const paused = useGameStore.getState().isPaused;
        if (paused !== this.physics.world.isPaused) {
            if (paused) this.physics.world.pause();
            else this.physics.world.resume();
        }
        if (paused) return;

        // 体重で鈍化したスクロール量（px = px/s × s）
        const dx =
            SCROLL_SPEED *
            this.weightFactor(SPEED_PER_KG, SPEED_FACTOR_MIN) *
            (delta / 1000);
        this.scrollSegments(dx);

        // ごはんのスポーン
        if (this.time.now >= this.nextFoodSpawnAt) {
            this.spawnFood();
            this.nextFoodSpawnAt =
                this.time.now +
                rand(FOOD_MIN_INTERVAL_MS, FOOD_MAX_INTERVAL_MS);
        }
        this.scrollFoods(dx);

        // ゲームオーバー判定（画面下まで落ちきったら）
        if (this.creature.y > this.scale.height + FALL_EXIT_MARGIN) {
            useGameStore.getState().exitAction();
            return;
        }

        this.applyChargeSquash();

        if (DEBUG) this.drawDebug();
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

    private drawDebug() {
        if (!this.debugGfx) return;
        const g = this.debugGfx;
        g.clear();

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
            if (f.active) g.strokeRect(f.x, f.y, FOOD_SIZE, FOOD_SIZE);
        }

        // キャラのスプライト全体（緑）
        const cx = this.creature.x;
        const cy = this.creature.y;
        const cw = this.creature.displayWidth;
        const ch = this.creature.displayHeight;
        g.lineStyle(2, 0x00ff00, 0.8);
        g.strokeRect(cx - cw * 0.5, cy - ch, cw, ch);

        // 物理ボディ（シアン）
        const body = this.creature.body as Phaser.Physics.Arcade.Body;
        g.lineStyle(2, 0x00ffff, 1);
        g.strokeRect(body.x, body.y, body.width, body.height);
    }
}
