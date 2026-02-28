import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  server: {
    port: 5000,
    strictPort: true
  },
  preview: {
    port: 5000,
    strictPort: true
  },
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, 'index.html'),
        classes: resolve(__dirname, 'classes/index.html'),
        about: resolve(__dirname, 'about/index.html'),
        contacts: resolve(__dirname, 'contacts/index.html'),
        news: resolve(__dirname, 'news/index.html')
      }
    }
  }
});
