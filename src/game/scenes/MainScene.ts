import Phaser from 'phaser';
import { stageOf, stageNoOf, useGameStore, type Stage } from '../../store/gameStore';

// 生物スプライトのキー命名規則: creature_<stageNo>_<form>_<motion>
// baby/child/adult の stop 素材を用意済み。update() の setTexture が体重ステージに応じて
// 自動で切替える。新モーション（walk 等）を足す場合も同じ命名で preload に追記する。
const creatureKey = (stageNo: number, form: Stage, motion: string) =>
  `creature_${stageNo}_${form}_${motion}`;

const SCALE_PER_KG      = 0.1;            // 体重 1kg = スケール 0.1（初期 5kg → 0.5倍）
const CREATURE_BASE_PX  = 128;            // 元画像の高さ

const SPEECH_PHRASE     = 'ぼーっとしている';
const DOT_INTERVAL_MS   = 500;
const SPEECH_GAP_PX     = 24;

// 待機モーション（それぞれ独立にランダム発生）
const ANIM_BREATH_MS    = 1400;
const ANIM_BREATH_AMP   = 0.12;
const BREATH_MIN_MS     = 2000;
const BREATH_MAX_MS     = 5000;

const ANIM_SHAKE_MS     = 500;
const ANIM_SHAKE_AMP_PX = 3;
const SHAKE_MIN_MS      = 2500;
const SHAKE_MAX_MS      = 6000;

type Motion = { active: boolean; t: number; nextDelay: number };

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export class MainScene extends Phaser.Scene {
  private creature!: Phaser.GameObjects.Image;
  private speechText!: Phaser.GameObjects.Text;

  private dotPhase = 0;
  private dotTimer = 0;

  private breath: Motion = { active: false, t: 0, nextDelay: rand(BREATH_MIN_MS, BREATH_MAX_MS) };
  private shake: Motion  = { active: false, t: 0, nextDelay: rand(SHAKE_MIN_MS, SHAKE_MAX_MS) };

  constructor() { super({ key: 'MainScene' }); }

  preload() {
    this.load.image(creatureKey(1, 'baby', 'stop'), 'assets/creature_1_baby_stop.png');
    this.load.image(creatureKey(2, 'child', 'stop'), 'assets/creature_2_child_stop.png');
    this.load.image(creatureKey(3, 'adult', 'stop'), 'assets/creature_3_adult_stop.png');
  }

  create() {
    this.cameras.main.setBackgroundColor('#000000');

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    // 原点を最下中央に。scale を変えても最下点は動かない
    this.creature = this.add
      .image(cx, cy, creatureKey(1, 'baby', 'stop'))
      .setOrigin(0.5, 1.0);

    this.speechText = this.add
      .text(cx, 0, SPEECH_PHRASE + '.', {
        fontFamily: '"DotGothic16", monospace',
        fontSize: '20px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 1);
  }

  update(_time: number, delta: number) {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const { weight, isPaused } = useGameStore.getState();
    if (isPaused) return; // 一時停止中はアニメも進めない
    const baseScale = weight * SCALE_PER_KG;

    // ステージ対応スプライトが存在すれば切替（無ければ現テクスチャ維持）
    const desiredKey = creatureKey(stageNoOf(weight), stageOf(weight), 'stop');
    if (this.textures.exists(desiredKey) && this.creature.texture.key !== desiredKey) {
      this.creature.setTexture(desiredKey);
    }

    // ── 各モーションは独立した乱数スケジュールで発生 ──
    this.tickMotion(this.breath, delta, ANIM_BREATH_MS, BREATH_MIN_MS, BREATH_MAX_MS);
    this.tickMotion(this.shake,  delta, ANIM_SHAKE_MS,  SHAKE_MIN_MS,  SHAKE_MAX_MS);

    let scale = baseScale;
    let offsetX = 0;

    if (this.breath.active) {
      const t = this.breath.t / ANIM_BREATH_MS;
      scale *= 1 + Math.sin(t * Math.PI) * ANIM_BREATH_AMP;
    }
    if (this.shake.active) {
      const t = this.shake.t / ANIM_SHAKE_MS;
      const fade = Math.max(0, 1 - t);
      offsetX = Math.sin(this.shake.t / 22) * ANIM_SHAKE_AMP_PX * fade;
    }

    // 最下点は常に cy に固定
    this.creature.setPosition(cx + offsetX, cy).setScale(scale);

    // セリフは画面中央からの固定オフセット（キャラのサイズ変化の影響を受けない）
    this.speechText.setPosition(cx, cy - CREATURE_BASE_PX - SPEECH_GAP_PX);

    this.dotTimer += delta;
    if (this.dotTimer >= DOT_INTERVAL_MS) {
      this.dotTimer -= DOT_INTERVAL_MS;
      this.dotPhase = (this.dotPhase + 1) % 3;
      this.speechText.setText(SPEECH_PHRASE + '.'.repeat(this.dotPhase + 1));
    }
  }

  private tickMotion(m: Motion, delta: number, durationMs: number, minMs: number, maxMs: number) {
    if (m.active) {
      m.t += delta;
      if (m.t >= durationMs) {
        m.active = false;
        m.t = 0;
        m.nextDelay = rand(minMs, maxMs);
      }
    } else {
      m.nextDelay -= delta;
      if (m.nextDelay <= 0) {
        m.active = true;
        m.t = 0;
      }
    }
  }
}
