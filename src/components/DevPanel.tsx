import { useState } from 'react';
import { useGameStore, HUNGER_MAX } from '../store/gameStore';
import { titleFor } from '../titles';

// 開発用テストパネル（dev ビルド限定・本番には出ない）。
// 任意の状態へ即ジャンプして全機能をすぐ試すための道具。
export function DevPanel() {
  if (!import.meta.env.DEV) return null;
  return <DevPanelInner />;
}

function DevPanelInner() {
  const [open, setOpen] = useState(false);
  const s = useGameStore();
  const set = useGameStore.setState;
  const api = useGameStore.getState;

  const btn = 'px-2 py-1 text-xs border border-white/60 bg-black text-white active:bg-white active:text-black rounded-sm';
  const row = 'flex flex-wrap items-center gap-1';
  const label = 'w-16 shrink-0 text-xs opacity-70';

  return (
    <div className="fixed bottom-2 left-2 z-[60]" style={{ fontFamily: 'monospace' }}>
      {!open ? (
        <button
          data-testid="dev-toggle"
          onClick={() => setOpen(true)}
          className="px-2 py-1 text-xs border border-yellow-300 text-yellow-300 bg-black/80 rounded-sm"
        >
          🛠 TEST
        </button>
      ) : (
        <div className="w-64 max-h-[80vh] overflow-auto p-2 bg-black/90 border border-yellow-300 text-white rounded-sm flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-yellow-300">DEV TEST PANEL</span>
            <button onClick={() => setOpen(false)} className={btn}>×</button>
          </div>

          {/* 現在値 */}
          <div className="text-[10px] leading-relaxed opacity-80 tabular-nums">
            screen={s.screen} mode={s.mode}<br />
            体重={s.weight.toFixed(1)} 食料={s.food} 空腹={s.hunger.toFixed(0)}<br />
            日数={s.days} 転生={s.reincarnationCount} 称号={titleFor(s.reincarnationCount) ?? 'なし'}
          </div>

          {/* 画面 */}
          <div className={row}>
            <span className={label}>画面</span>
            <button className={btn} onClick={() => set({ screen: 'title' })}>タイトル</button>
            <button className={btn} onClick={() => set({ screen: 'game', mode: 'care' })}>育成</button>
            <button className={btn} onClick={() => api().enterAction()}>あそぶ</button>
            <button className={btn} onClick={() => api().exitAction()}>もどる</button>
          </div>

          {/* 体重 */}
          <div className={row}>
            <span className={label}>体重</span>
            {[5, 9.8, 10, 24.5, 25, 30].map((w) => (
              <button key={w} className={btn} onClick={() => set({ weight: w })}>{w}</button>
            ))}
          </div>

          {/* 空腹 */}
          <div className={row}>
            <span className={label}>空腹</span>
            {[0, 50, 80, 99].map((h) => (
              <button key={h} className={btn} onClick={() => set({ hunger: h })}>{h}</button>
            ))}
          </div>

          {/* 食料 / 転生回数 */}
          <div className={row}>
            <span className={label}>食料</span>
            <button className={btn} onClick={() => set({ food: s.food + 5 })}>+5</button>
            <button className={btn} onClick={() => set({ food: 0 })}>0</button>
          </div>
          <div className={row}>
            <span className={label}>転生回数</span>
            {[0, 4, 5, 9, 14].map((n) => (
              <button key={n} className={btn} onClick={() => set({ reincarnationCount: n })}>{n}</button>
            ))}
          </div>

          {/* アクション/イベント */}
          <div className={row}>
            <span className={label}>イベント</span>
            <button className={btn} onClick={() => api().feed()}>ごはん</button>
            <button className={btn} onClick={() => api().reincarnate()}>転生</button>
          </div>
          <div className={row}>
            <span className={label}>演出</span>
            <button className={btn} onClick={() => set({ milestones: [...s.milestones, 'テスト演出'] })}>節目</button>
            <button
              className={btn}
              onClick={() => {
                // 永遠の眠りを即発火（空腹を限界にして tick）
                set({ hunger: HUNGER_MAX, screen: 'game' });
                api().tick();
              }}
            >
              永眠
            </button>
          </div>

          {/* セーブ */}
          <div className={row}>
            <span className={label}>セーブ</span>
            <button
              className={btn}
              onClick={() => {
                localStorage.removeItem('dogwalk-save');
                api().resetGame();
              }}
            >
              消去して最初から
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
