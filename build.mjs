import { readFile } from 'node:fs/promises'

import { build } from 'esbuild'

const packageJson = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'))

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: true,
  packages: 'external',
  banner: { js: '#!/usr/bin/env node' },
  define: { __TAODOCK_MCP_VERSION__: JSON.stringify(packageJson.version) },
})
