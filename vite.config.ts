import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 公開時のサブパス。リポジトリ名と合わせる。
// 開発 (vite dev) では '/' で動作するように分岐。
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/DogWalk/' : '/',
  plugins: [react()],
}));
