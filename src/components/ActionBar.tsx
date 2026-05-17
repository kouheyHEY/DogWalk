import { useGameStore } from '../store/gameStore';
import { EventBus, EVENTS } from '../game/EventBus';

const STATE_LABEL: Record<string, { text: string; color: string }> = {
  walking:         { text: '>> WALKING',  color: '#44ff88' },
  refusing:        { text: '!! REFUSE !!', color: '#ff4444' },
  checkpoint_rest: { text: 'ZZ  REST  ZZ', color: '#ffcc00' },
  manual_rest:     { text: 'zz  rest  zz', color: '#88ccff' },
};

export function ActionBar() {
  const {
    stamina, food,
    dogState, manualRestTimeLeft,
    autoDepart, toggleAutoDepart,
  } = useGameStore();

  const isWalking  = dogState === 'walking';
  const isAtCP     = dogState === 'checkpoint_rest';
  const isResting  = dogState === 'manual_rest';
  const isRefusing = dogState === 'refusing';
  const canFeed    = food > 0 && !isAtCP;
  const canRest    = isWalking;
  const canDepart  = isAtCP && stamina >= 50;

  const label = STATE_LABEL[dogState] ?? STATE_LABEL.walking;

  return (
    <div className="retro-panel flex flex-col gap-2 shrink-0 p-2">
      {/* 状態表示 */}
      <div
        className={['text-[8px] text-center py-1', isRefusing ? 'blink' : ''].join(' ')}
        style={{ color: label.color }}
      >
        {label.text}
      </div>

      {/* ボタン行 */}
      <div className="flex gap-2 items-center">
        {/* EAT */}
        <button
          onClick={() => EventBus.emit(EVENTS.FEED_DOG)}
          disabled={!canFeed}
          className="retro-btn flex-1 py-3 px-2 min-w-[80px]"
          style={{
            color: 'var(--food)',
            borderColor: canFeed ? 'var(--food)' : undefined,
            boxShadow: canFeed ? `3px 3px 0 var(--food)` : undefined,
          }}
        >
          EAT x{food}
        </button>

        {/* REST */}
        <button
          onClick={() => EventBus.emit(EVENTS.REST_DOG)}
          disabled={!canRest}
          className="retro-btn flex-1 py-3 px-2 min-w-[80px]"
          style={{
            color: 'var(--mp)',
            borderColor: canRest ? 'var(--mp)' : undefined,
            boxShadow: canRest ? `3px 3px 0 var(--mp)` : undefined,
          }}
        >
          {isResting ? `ZZZ ${Math.ceil(manualRestTimeLeft)}s` : 'REST'}
        </button>

        {/* GO! (チェックポイント時のみ) */}
        {isAtCP && (
          <button
            onClick={() => EventBus.emit(EVENTS.DEPART)}
            disabled={!canDepart}
            className="retro-btn flex-1 py-3 px-2 min-w-[80px]"
            style={{
              color: '#44ff88',
              borderColor: canDepart ? '#44ff88' : undefined,
              boxShadow: canDepart ? '3px 3px 0 #44ff88' : undefined,
            }}
          >
            {canDepart ? 'GO!' : `${Math.floor(stamina)}/50`}
          </button>
        )}
      </div>

      {/* AUTO 設定 */}
      {isAtCP && (
        <label
          className="flex items-center justify-center gap-1.5 text-[7px] cursor-pointer"
          style={{ color: '#888899' }}
        >
          <input
            type="checkbox"
            checked={autoDepart}
            onChange={toggleAutoDepart}
            className="w-3 h-3"
            style={{ accentColor: '#44ff88' }}
          />
          AUTO DEPART
        </label>
      )}
    </div>
  );
}
