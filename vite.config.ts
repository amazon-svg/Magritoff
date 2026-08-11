import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { projectId, publicAnonKey } from './utils/supabase/info'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

const enableBundleAnalysis = process.env.ANALYZE === '1'

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    // R7 (refacto 2026-05-11) : bundle visualizer opt-in via ANALYZE=1.
    // Genere dist/stats.html avec treemap des chunks pour identifier la
    // dette bundle (audit ADR-R8 review §1.2 M1).
    ...(enableBundleAnalysis
      ? [
          visualizer({
            filename: 'dist/stats.html',
            open: false,
            gzipSize: true,
            brotliSize: true,
            template: 'treemap',
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  // Façade API locale : le navigateur ne connaît que /api/v1. Le proxy Vite
  // est la composition d'infrastructure de développement et masque
  // l'hébergement Supabase de l'API métier access-management.
  server: {
    proxy: {
      '/api/v1': {
        target: `https://${projectId}.supabase.co`,
        changeOrigin: true,
        headers: { apikey: publicAnonKey },
        rewrite: (requestPath) => `/functions/v1/access-management${requestPath}`,
      },
    },
  },

  // R7 : seuil bundle warning a 600 KB (au-dela = warning Vite explicite).
  // La baseline actuelle est ~890 KB → on documente comme dette technique
  // a reduire au fil du temps (story future de chunking manuel ou dynamic
  // imports plus aggresifs).
  build: {
    chunkSizeWarningLimit: 600,
  },
})
