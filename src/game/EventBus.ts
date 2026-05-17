import Phaser from 'phaser';

export const EventBus = new Phaser.Events.EventEmitter();

export const EVENTS = {
  FEED_DOG:    'feed_dog',
  REST_DOG:    'rest_dog',
  DEPART:      'depart',
  SCENE_READY: 'scene_ready',
} as const;
