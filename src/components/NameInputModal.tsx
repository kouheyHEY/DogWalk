import { useState } from 'react';
import { NAME_PATTERN, useGameStore } from '../store/gameStore';

export function NameInputModal() {
  const setName = useGameStore((s) => s.setName);
  const [value, setValue] = useState('');
  const valid = NAME_PATTERN.test(value);

  return (
    <div
      data-testid="name-modal"
      className="absolute inset-0 z-10 flex items-center justify-center bg-black"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) setName(value);
        }}
        className="flex flex-col items-center gap-4 px-6"
      >
        <div className="text-xl">なまえを つけてください</div>
        <input
          data-testid="name-input"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={4}
          autoFocus
          className="w-40 px-3 py-2 text-2xl text-center text-white bg-black border-2 border-white tabular-nums"
        />
        <div className="text-sm opacity-70">ひらがな・カタカナ 4もじまで</div>
        <button
          type="submit"
          disabled={!valid}
          data-testid="name-submit"
          className="px-6 py-2 text-lg border-2 border-white bg-black text-white active:bg-white active:text-black disabled:opacity-30 disabled:active:bg-black disabled:active:text-white"
        >
          けってい
        </button>
      </form>
    </div>
  );
}
