import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// New v2 tournament platform — fully isolated from ../frontend (the live KOC app) and its
// Firebase Realtime Database project. This project targets Firestore instead. Runs on a
// different dev-server port so both can run side by side locally.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'build',
    sourcemap: false,
  },
});
