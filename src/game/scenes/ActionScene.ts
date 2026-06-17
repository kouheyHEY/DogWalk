import Phaser from "phaser";
import { useGameStore } from "../../store/gameStore";
import { sound } from "../../audio/sound";

const SCALE_PER_KG = 0.1; // MainScene と同じ基準

// 物理は Arcade に統一。単位は px/s 系。
// ルールはシンプル: 足場の上を走り、ギャップはジャンプで跳び越す。穴に落ちたら育成画面へ戻る。
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

// キャラの当たり判定 / テクスチャの比率（PNG の透明余白を除外するため）。
// スプライト下半分にキャラが居る前提で、ボディは下寄せに配置する。
// 横は見た目より気持ち広い程度に絞り、足場の左側面で「ボディだけ手前にはみ出る」のを抑える。
const COLLISION_WIDTH_RATIO = 0.5;
const COLLISION_HEIGHT_RATIO = 0.3;

// ごはん
const FOOD_SIZE = 24;
const FOOD_MIN_INTERVAL_MS = 1500;
const FOOD_MAX_INTERVAL_MS = 3500;
const FOOD_MIN_HEIGHT_ABOVE_GROUND = 8;
const FOOD_MAX_HEIGHT_ABOVE_GROUND = 130;

// 地面: 表面（草）と本体（土）でスプライトを分ける。表面はこの高さの帯で上に重ねる。
const GRASS_H = 20;

// アクション背景テーマ（入場ごとにランダム選択）: 空色 + 星の有無
const BG_THEMES = [
    { sky: "#9ad0ee", stars: false }, // 昼
    { sky: "#f2b07a", stars: false }, // 夕
    { sky: "#141d33", stars: true }, // 夜
] as const;

// デバッグ描画
const DEBUG = false;

interface GroundSegment {
    rect: Phaser.GameObjects.TileSprite; // 土（本体・物理ボディ付き）
    grass: Phaser.GameObjects.TileSprite; // 草（表面・装飾／速度で同期スクロール）
    width: number;
}

function rand(min: number, max: number) {
    return min + Math.random() * (max - min);
}

// 横スクロールアクション用シーン。
// キャラは物理ボディ（gravity + 衝突）、地面とごはんは静的ボディ（手動でスクロール）。
export class ActionScene extends Phaser.Scene {
    private creature!: Phaser.Physics.Arcade.Image;
    private groundY = 0;
    private baseScale = 0.5;
    private baseX = 0;
    private segments: GroundSegment[] = [];
    private segmentGroup!: Phaser.Physics.Arcade.Group;
    private grassGroup!: Phaser.Physics.Arcade.Group; // 草表面（衝突なし・速度で動かすだけ）
    private foods: Phaser.GameObjects.Image[] = [];
    private foodGroup!: Phaser.Physics.Arcade.Group;
    private nextFoodSpawnAt = 0;
    private pointerDownAt: number | null = null;
    private debugGfx?: Phaser.GameObjects.Graphics;
    private stars?: Phaser.GameObjects.TileSprite; // 夜テーマの星

    constructor() {
        super({
            key: "ActionScene",
            physics: {
                default: "arcade",
                arcade: { debug: false },
            },
        });
    }

    preload() {
        this.load.image("creature", "assets/creature_1_baby_stop.png");
        this.load.image("ground_body", "assets/ground_body.png");
        this.load.image("ground_surface", "assets/ground_surface.png");
        this.load.image("food_apple", "assets/food_apple.png");
        this.load.image("stars", "assets/stars.png");
    }

    create() {
        // 背景テーマを入場ごとにランダム選択（空 → 星 → 地面 → キャラ の奥行き）
        const theme = BG_THEMES[Math.floor(Math.random() * BG_THEMES.length)];
        this.cameras.main.setBackgroundColor(theme.sky);
        this.pointerDownAt = null;
        this.segments = [];
        this.foods = [];
        this.nextFoodSpawnAt = 0;
        this.stars = undefined;

        // 星（夜テーマのみ・最奥）
        if (theme.stars) {
            this.stars = this.add
                .tileSprite(0, 0, this.scale.width, this.scale.height, "stars")
                .setOrigin(0, 0)
                .setTileScale(2, 2)
                .setDepth(-6);
        }

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
        // body.setSize / setOffset はテクスチャピクセル単位。
        // 水平方向は中央配置、垂直方向はテクスチャ下端に揃える（上半分の透明余白を除外）。
        const bodyW = this.creature.width * COLLISION_WIDTH_RATIO;
        const bodyH = this.creature.height * COLLISION_HEIGHT_RATIO;
        body.setSize(bodyW, bodyH, false);
        body.setOffset(
            (this.creature.width - bodyW) / 2,
            this.creature.height - bodyH,
        );

        // 地面セグメント・ごはん用のグループ。
        // 動的不動 (immovable + allowGravity=false) にして velocity で動かす。
        // 静的だと手動位置変更時に side collision の押し戻しがうまく走らない。
        this.segmentGroup = this.physics.add.group({
            allowGravity: false,
            immovable: true,
        });
        // 草表面は衝突に関与せず、土と同じ速度でスクロールさせるためだけのグループ。
        this.grassGroup = this.physics.add.group({
            allowGravity: false,
            immovable: true,
        });
        this.foodGroup = this.physics.add.group({
            allowGravity: false,
            immovable: true,
        });

        // 衝突応答（着地・側面押し出しを物理に任せる）
        this.physics.add.collider(this.creature, this.segmentGroup);
        // ごはんはオーバーラップで取得処理
        this.physics.add.overlap(this.creature, this.foodGroup, (_c, food) => {
            (food as Phaser.GameObjects.GameObject).destroy();
            useGameStore.getState().gainFood();
            sound.playSE("pickup");
        });

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

    // 足場の高さ（地面ラインから画面下端まで）。
    private segmentHeight(): number {
        return this.scale.height - this.groundY;
    }

    // セグメントを 1 つ生成。土（本体・物理ボディ）と草（表面・装飾）をペアで作る。
    private spawnSegment(x: number, width: number, segHeight: number) {
        // 土本体（地面ラインから下・コライダー対象）
        const rect = this.add
            .tileSprite(x, this.groundY, width, segHeight, "ground_body")
            .setOrigin(0, 0)
            .setDepth(-2);
        this.segmentGroup.add(rect);
        const body = rect.body as Phaser.Physics.Arcade.Body;
        body.setSize(width, segHeight);
        body.setAllowGravity(false);
        body.setImmovable(true);
        body.setVelocityX(0); // velocity は毎フレーム update() で再設定

        // 草表面（上端に重ねる帯・キャラより奥）
        const grass = this.add
            .tileSprite(x, this.groundY, width, GRASS_H, "ground_surface")
            .setOrigin(0, 0)
            .setDepth(-1);
        this.grassGroup.add(grass);
        const gbody = grass.body as Phaser.Physics.Arcade.Body;
        gbody.setSize(width, GRASS_H);
        gbody.setAllowGravity(false);
        gbody.setImmovable(true);
        gbody.setVelocityX(0);

        return { rect, grass };
    }

    private fillSegmentsRight() {
        const w = this.scale.width;
        const segHeight = this.segmentHeight();
        let nextX = 0;
        if (this.segments.length > 0) {
            const last = this.segments[this.segments.length - 1];
            nextX =
                last.rect.x + last.width + rand(GAP_MIN_WIDTH, GAP_MAX_WIDTH);
        }
        while (nextX < w + SEG_MAX_WIDTH) {
            const width = rand(SEG_MIN_WIDTH, SEG_MAX_WIDTH);
            const { rect, grass } = this.spawnSegment(nextX, width, segHeight);
            this.segments.push({ rect, grass, width });
            nextX += width + rand(GAP_MIN_WIDTH, GAP_MAX_WIDTH);
        }
    }

    // 各セグメントに現在の前進速度（左方向）を適用する。
    private applySegmentVelocity() {
        const vx =
            -SCROLL_SPEED * this.weightFactor(SPEED_PER_KG, SPEED_FACTOR_MIN);
        for (const s of this.segments) {
            (s.rect.body as Phaser.Physics.Arcade.Body).setVelocityX(vx);
            // 草表面も同じ速度で（同一物理ステップで動くので土とズレない）
            (s.grass.body as Phaser.Physics.Arcade.Body).setVelocityX(vx);
        }
        for (const f of this.foods) {
            if (!f.active) continue;
            (f.body as Phaser.Physics.Arcade.Body | null)?.setVelocityX(vx);
        }
    }

    // 画面外（左）に出たセグメントを右端にリサイクル。新サイズ＆ギャップで再配置。
    private recycleSegments() {
        const segHeight = this.segmentHeight();
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
            s.width = newWidth;
            s.rect.setSize(newWidth, segHeight);
            const body = s.rect.body as Phaser.Physics.Arcade.Body;
            body.setSize(newWidth, segHeight);
            // body.reset は body と GameObject を (x, y) に移動し、velocity を 0 にする
            body.reset(newX, this.groundY);
            // 草表面も同じ幅・位置へ
            s.grass.setSize(newWidth, GRASS_H);
            const gbody = s.grass.body as Phaser.Physics.Arcade.Body;
            gbody.setSize(newWidth, GRASS_H);
            gbody.reset(newX, this.groundY);
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
            .image(x, y, "food_apple")
            .setOrigin(0, 0)
            .setDisplaySize(FOOD_SIZE, FOOD_SIZE);
        this.foodGroup.add(f);
        const body = f.body as Phaser.Physics.Arcade.Body;
        body.setSize(FOOD_SIZE, FOOD_SIZE);
        body.setAllowGravity(false);
        body.setImmovable(true);
        body.setVelocityX(0); // update() で再設定
        this.foods.push(f);
    }

    // 画面外（左）or 取得済みのごはんを除去。
    private cullFoods() {
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

        // 星は全画面に追従。
        this.stars?.setSize(w, h);

        const segHeight = this.segmentHeight();
        for (const s of this.segments) {
            const body = s.rect.body as Phaser.Physics.Arcade.Body;
            const vx = body.velocity.x;
            const x = s.rect.x;
            s.rect.setSize(s.width, segHeight);
            body.setSize(s.width, segHeight);
            body.reset(x, this.groundY);
            body.setVelocityX(vx);
            // 草表面を土に追従
            s.grass.setSize(s.width, GRASS_H);
            const gbody = s.grass.body as Phaser.Physics.Arcade.Body;
            gbody.setSize(s.width, GRASS_H);
            gbody.reset(x, this.groundY);
            gbody.setVelocityX(vx);
        }

        this.fillSegmentsRight();

        // 初期位置（まだ配置されていなければ地面の上に置く）
        const body = this.creature.body as Phaser.Physics.Arcade.Body;
        if (this.creature.x === 0 && this.creature.y === 0) {
            body.reset(this.baseX, this.groundY);
        }
    }

    update(_time: number, delta: number) {
        const paused = useGameStore.getState().isPaused;
        if (paused !== this.physics.world.isPaused) {
            if (paused) this.physics.world.pause();
            else this.physics.world.resume();
        }
        if (paused) return;

        // セグメントとごはんに体重に応じた前進速度を毎フレーム適用（Phaser 物理が動かす）
        this.applySegmentVelocity();
        this.recycleSegments();

        // ごはんのスポーン
        if (this.time.now >= this.nextFoodSpawnAt) {
            this.spawnFood();
            this.nextFoodSpawnAt =
                this.time.now +
                rand(FOOD_MIN_INTERVAL_MS, FOOD_MAX_INTERVAL_MS);
        }
        this.cullFoods();

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
