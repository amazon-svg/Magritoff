import { build } from 'vite';

// Keep dependencies external (including native modules); bundle application TS.
await build({
  configFile: false,
  publicDir: false,
  build: {
    ssr: true,
    target: 'node22',
    outDir: 'dist-server',
    rollupOptions: {
      input: Object.fromEntries([
        'production-main', 'notification-worker-main', 'outbox-worker-main',
        'order-file-purge-worker-main', 'order-export-worker-main',
      ].map((name) => [name, `src/server/node/${name}.ts`])),
      output: { entryFileNames: '[name].js' },
    },
  },
});
