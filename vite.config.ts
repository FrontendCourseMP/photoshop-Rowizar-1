import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Repo name on GitHub: photoshop-Rowizar-1
export default defineConfig({
  base: process.env['GITHUB_ACTIONS'] ? '/photoshop-Rowizar-1/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
