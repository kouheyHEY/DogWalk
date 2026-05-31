import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { MainScene } from '../game/scenes/MainScene';
import { ActionScene } from '../game/scenes/ActionScene';
import { useGameStore } from '../store/gameStore';

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      scene: [MainScene, ActionScene],
      backgroundColor: '#000000',
      antialias: false,
      pixelArt: true,
      roundPixels: true,
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });

    // mode に応じて MainScene ↔ ActionScene を切り替える
    const switchScene = (mode: 'care' | 'action') => {
      const showKey = mode === 'action' ? 'ActionScene' : 'MainScene';
      const hideKey = mode === 'action' ? 'MainScene' : 'ActionScene';
      if (game.scene.isActive(hideKey) || game.scene.isSleeping(hideKey)) {
        game.scene.stop(hideKey);
      }
      if (!game.scene.isActive(showKey)) {
        game.scene.start(showKey);
      }
    };

    // 初期 mode を反映
    switchScene(useGameStore.getState().mode);

    const unsub = useGameStore.subscribe((state, prev) => {
      if (state.mode !== prev.mode) switchScene(state.mode);
    });

    return () => {
      unsub();
      game.destroy(true);
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" />;
}
