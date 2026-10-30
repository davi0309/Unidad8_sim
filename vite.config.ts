import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas: funciona en GitHub Pages sin importar el nombre del repo
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Babylon.js es grande por naturaleza; se optimiza en la Fase 7
    chunkSizeWarningLimit: 7000,
  },
});
