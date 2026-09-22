import { defineConfig, loadEnv } from 'vite'
import { readFileSync } from 'node:fs'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'


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

function openapiDocsPlugin() {
  const contractPath = path.resolve(__dirname, 'openapi/magrit-core.v1.yaml')
  const docsHtml = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Magrit API</title>
  </head>
  <body>
    <redoc spec-url="/docs/openapi.yaml"></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>`

  return {
    name: 'openapi-docs',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url === '/docs/openapi.yaml') {
          response.setHeader('Content-Type', 'text/yaml; charset=utf-8')
          response.end(readFileSync(contractPath, 'utf8'))
          return
        }

        if (request.url === '/docs/openapi' || request.url === '/docs/openapi/') {
          response.setHeader('Content-Type', 'text/html; charset=utf-8')
          response.end(docsHtml)
          return
        }

        next()
      })
    },
  }
}

const enableBundleAnalysis = process.env.ANALYZE === '1'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget =
    env.VITE_API_PROXY_TARGET ||
    'https://ightkxebexuzfjdbpsdg.supabase.co/functions/v1/magrit-api'

  return {
  plugins: [
    figmaAssetResolver(),
    openapiDocsPlugin(),
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

  server: {
    proxy: {
      '/api/v1': {
        target: apiProxyTarget,
        changeOrigin: true,
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
  }
})
