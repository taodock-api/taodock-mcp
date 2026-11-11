import { chmod, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'

import { build } from 'esbuild'

const root = process.cwd()
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const stage = path.join(root, 'mcpb-stage')
const artifact = path.join(root, `taodock-mcp-${packageJson.version}.mcpb`)

await rm(stage, { recursive: true, force: true })
await mkdir(path.join(stage, 'server'), { recursive: true })
await mkdir(path.join(stage, 'assets'), { recursive: true })

await build({
  entryPoints: [path.join(root, 'src/index.ts')],
  outfile: path.join(stage, 'server/index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  banner: { js: '#!/usr/bin/env node' },
  define: { __TAODOCK_MCP_VERSION__: JSON.stringify(packageJson.version) },
})
await chmod(path.join(stage, 'server/index.mjs'), 0o755)

for (const file of ['LICENSE', 'PRIVACY.md', 'README.md']) await cp(path.join(root, file), path.join(stage, file))
await cp(path.join(root, 'assets/icon.png'), path.join(stage, 'assets/icon.png'))

const manifest = {
  manifest_version: '0.3',
  name: 'taodock-mcp',
  display_name: 'TaoDock',
  version: packageJson.version,
  description: packageJson.description,
  long_description: 'Generate images and videos with models enabled for your TaoDock API key.',
  author: { name: 'TaoDock', url: 'https://taodock.com' },
  homepage: 'https://taodock.com',
  repository: { type: 'git', url: 'https://github.com/taodock-api/taodock-mcp.git' },
  support: 'https://github.com/taodock-api/taodock-mcp/issues',
  privacy_policies: ['https://taodock.com/privacy-policy'],
  license: 'MIT',
  icon: 'assets/icon.png',
  server: {
    type: 'node',
    entry_point: 'server/index.mjs',
    mcp_config: {
      command: 'node',
      args: ['${__dirname}/server/index.mjs'],
      env: {
        TAODOCK_API_KEY: '${user_config.taodock_api_key}',
        TAODOCK_BASE_URL: '${user_config.taodock_base_url}',
        TAODOCK_OUTPUT_DIR: '${user_config.taodock_output_dir}',
        TAODOCK_LOCALE: '${user_config.taodock_locale}',
      },
    },
  },
  tools: [
    { name: 'list_models', description: 'List models available to the TaoDock API key.' },
    { name: 'generate_image', description: 'Generate an image and save it locally.' },
    { name: 'create_video', description: 'Start a TaoDock video generation task.' },
    { name: 'get_video_status', description: 'Read a TaoDock video task status.' },
    { name: 'download_video', description: 'Download a completed TaoDock video.' },
  ],
  user_config: {
    taodock_api_key: {
      type: 'string',
      title: 'TaoDock API key',
      description: 'Create a key at https://taodock.com/keys',
      sensitive: true,
      required: true,
    },
    taodock_base_url: {
      type: 'string',
      title: 'TaoDock API base URL',
      description: 'Keep the default unless you use a compatible TaoDock deployment.',
      default: 'https://taodock.com/v1',
      required: false,
    },
    taodock_output_dir: {
      type: 'directory',
      title: 'Output directory',
      description: 'Where generated images and videos are saved.',
      default: '${DOWNLOADS}/TaoDock',
      required: false,
    },
    taodock_locale: {
      type: 'string',
      title: 'Error message language',
      description: 'Use en for English or zh for Simplified Chinese.',
      default: 'en',
      required: false,
    },
  },
}
await writeFile(path.join(stage, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`))))
  })
}

await run('npx', ['-y', '@anthropic-ai/mcpb@2.1.2', 'validate', stage], root)
await rm(artifact, { force: true })
await run('npx', ['-y', '@anthropic-ai/mcpb@2.1.2', 'pack', stage, artifact], root)
