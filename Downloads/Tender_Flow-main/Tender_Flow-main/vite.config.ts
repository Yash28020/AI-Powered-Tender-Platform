import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  resolve: {
    dedupe: ['react', 'react-dom'], // keep this
  },

  optimizeDeps: {
    exclude: ['pdfjs-dist'], // ⬅️ THIS IS THE FIX
  },
});
