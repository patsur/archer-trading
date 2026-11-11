import { defineConfig } from 'vite';

// Builds a single IIFE bundle with React as an external global (loaded from cdnjs),
// used by scripts/build-artifact.mjs to produce one self-contained HTML page.
export default defineConfig({
  esbuild: {
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    jsxInject: `import React from 'react'`,
  },
  build: {
    outDir: 'dist-artifact',
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: 'src/main.tsx',
      external: ['react', 'react-dom', 'react-dom/client'],
      output: {
        format: 'iife',
        entryFileNames: 'app.js',
        assetFileNames: 'app[extname]',
        globals: { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM' },
      },
    },
  },
});
