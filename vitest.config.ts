import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    exclude: ['tests/e2e/**', '**/node_modules/**', '**/dist/**'],
    environment: 'node',
    setupFiles: ['./tests/_loadEnv.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // R8 (refacto 2026-05-11 ADR-R5) : coverage v8 + seuils baseline.
    // Les seuils sont volontairement bas en R8 (zones froides historiquement
    // non testees, on remonte progressivement en V1.x).
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/types/database.types.ts',
        'src/**/*.d.ts',
        // UI lourd (composants) : couverture indirecte via les helpers
        // extraits (.helpers.ts). Pas de threshold dur sur les .tsx.
        'src/main.tsx',
        'src/index.css',
      ],
      // Seuils baseline R8 : la coverage globale est faible (~8 %) car
      // les contexts/composants UI lourds (~80 % du code) sont historiquement
      // sans tests vitest. Les zones froides critiques (priceResolver,
      // ClariprintAdapter, clariprintQuote) sont a 50-90 %. On bloque
      // la regression sous la baseline actuelle, sans imposer un objectif
      // ambitieux qui serait demoralisant. Relever ces seuils dans
      // futures stories au fil des extractions de helpers testables.
      thresholds: {
        lines: 7,
        functions: 3,
        branches: 7,
        statements: 7,
      },
    },
  },
});
