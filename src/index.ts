import path from 'node:path'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

import { TaoDockApiError, TaoDockClient } from './client.js'
import {
  TAODOCK_KEYS,
  TAODOCK_MODELS,
  TAODOCK_WALLET,
  modelGuide,
  registrationUrl,
} from './config.js'
import { createVideo, downloadVideo, generateImage, getVideo, waitForVideo } from './media.js'
import { ModelDirectory, type ModelKind } from './models.js'
import { extensionFor, OutputDirectory } from './output.js'

const VERSION = __TAODOCK_MCP_VERSION__
const LOCALE = process.env.TAODOCK_LOCALE === 'zh' ? 'zh' : 'en'
const MAX_INLINE_IMAGE_BASE64 = 1_500_000
const MAX_WAIT_SECONDS = 300
const output = new OutputDirectory(process.env.TAODOCK_OUTPUT_DIR?.trim() || path.join(process.cwd(), 'taodock-output'))

let client: TaoDockClient | undefined
let directory: ModelDirectory | undefined

function activeClient(): TaoDockClient {
  if (client) return client
  const apiKey = process.env.TAODOCK_API_KEY?.trim()
  if (!apiKey) {
    throw new TaoDockApiError(
      LOCALE === 'zh'
        ? `未设置 TAODOCK_API_KEY。请在 ${TAODOCK_KEYS} 创建密钥；没有账号可访问 ${registrationUrl('mcp-registry')}`
        : `TAODOCK_API_KEY is not set. Create a key at ${TAODOCK_KEYS}; register at ${registrationUrl('mcp-registry')}`,
      { kind: 'unauthorized' },
    )
  }
  client = new TaoDockClient({
    apiKey,
    pluginVersion: VERSION,
    ...(process.env.TAODOCK_BASE_URL ? { baseUrl: process.env.TAODOCK_BASE_URL } : {}),
  })
  return client
}

function modelDirectory(): ModelDirectory {
  directory ??= new ModelDirectory({ client: activeClient() })
  return directory
}

function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] }
}

function errorMessage(error: TaoDockApiError): string {
  const request = error.requestId ? ` Request ID: ${error.requestId}.` : ''
  if (LOCALE === 'zh') {
    switch (error.kind) {
      case 'unauthorized':
        return `TaoDock 密钥无效或已失效。请在 ${TAODOCK_KEYS} 检查密钥。${request}`
      case 'insufficient_quota':
        return `TaoDock 额度不足。请检查 ${TAODOCK_WALLET}。${request}`
      case 'model_not_found':
        return `当前密钥无法使用该模型。请检查 ${TAODOCK_MODELS}。${request}`
      case 'rate_limited':
        return `请求过于频繁，请稍后重试。${request}`
      case 'timeout':
        return `TaoDock 请求超时，请稍后重试。${request}`
      case 'network':
        return `无法连接 TaoDock，请检查网络与 API 地址。${request}`
      default:
        return `${error.message}${request}`
    }
  }
  switch (error.kind) {
    case 'unauthorized':
      return `The TaoDock key is missing, invalid, or disabled. Check ${TAODOCK_KEYS}.${request}`
    case 'insufficient_quota':
      return `The TaoDock balance or key quota is insufficient. Check ${TAODOCK_WALLET}.${request}`
    case 'model_not_found':
      return `This key cannot use the requested model. Check ${TAODOCK_MODELS}.${request}`
    case 'rate_limited':
      return `TaoDock rate limit reached. Try again later.${request}`
    case 'timeout':
      return `The TaoDock request timed out. Try again later.${request}`
    case 'network':
      return `Could not connect to TaoDock. Check the network and API base URL.${request}`
    default:
      return `${error.message}${request}`
  }
}

function failed(error: unknown): CallToolResult {
  const message = error instanceof TaoDockApiError ? errorMessage(error) : error instanceof Error ? error.message : String(error)
  return { isError: true, content: [{ type: 'text', text: message }] }
}

const modelParameters = z
  .record(z.string(), z.unknown())
  .optional()
  .describe('Model-specific request fields. Use the TaoDock model guide for supported values.')

const server = new McpServer({ name: 'taodock-mcp', version: VERSION })

server.registerTool(
  'list_models',
  {
    title: 'List TaoDock models',
    description: 'Lists the models available to the configured TaoDock API key. Defaults to image and video models.',
    inputSchema: {
      kind: z.enum(['image', 'video', 'text']).optional().describe('Only include this model kind.'),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ kind }) => {
    try {
      const snapshot = await modelDirectory().load({ force: true })
      const included: ModelKind[] = kind ? [kind] : ['image', 'video']
      const models = snapshot.models
        .filter((model) => included.includes(model.kind))
        .map((model) => ({ id: model.id, kind: model.kind }))
      return textResult(
        JSON.stringify(
          {
            models,
            guide: modelGuide(LOCALE),
            ...(snapshot.catalogAvailable ? {} : { note: 'The TaoDock catalog could not be refreshed.' }),
          },
          null,
          2,
        ),
      )
    } catch (error) {
      return failed(error)
    }
  },
)

server.registerTool(
  'generate_image',
  {
    title: 'Generate an image',
    description: 'Generates or edits an image with a TaoDock model and saves the result locally.',
    inputSchema: {
      model: z.string().trim().min(1).describe('Image model ID returned by list_models.'),
      prompt: z.string().trim().min(1).describe('Image instruction.'),
      parameters: modelParameters,
      edit: z.boolean().optional().describe('Use the image edits route when the selected model supports it.'),
    },
    annotations: { openWorldHint: true },
  },
  async ({ model: modelId, prompt, parameters, edit }) => {
    try {
      const model = await modelDirectory().find(modelId, 'image')
      const images = await generateImage(activeClient(), {
        model,
        prompt,
        ...(parameters ? { parameters } : {}),
        ...(edit !== undefined ? { edit } : {}),
      })
      const saved: string[] = []
      const content: CallToolResult['content'] = []
      for (const image of images) {
        if (image.base64) {
          const mimeType = image.mimeType ?? 'image/png'
          const file = await output.saveBytes(model.id, extensionFor(mimeType, 'png'), Buffer.from(image.base64, 'base64'))
          saved.push(file)
          if (image.base64.length <= MAX_INLINE_IMAGE_BASE64) content.push({ type: 'image', data: image.base64, mimeType })
          continue
        }
        if (image.url) {
          const response = await fetch(image.url, { signal: AbortSignal.timeout(120_000) })
          if (!response.ok) throw new Error(`Generated image download returned HTTP ${response.status}`)
          saved.push(await output.saveResponse(model.id, 'png', response))
        }
      }
      content.unshift({ type: 'text', text: `Saved ${saved.length} image(s):\n${saved.join('\n')}` })
      return { content }
    } catch (error) {
      return failed(error)
    }
  },
)

server.registerTool(
  'create_video',
  {
    title: 'Create a video task',
    description: 'Starts an asynchronous TaoDock video generation task.',
    inputSchema: {
      model: z.string().trim().min(1).describe('Video model ID returned by list_models.'),
      request: z.record(z.string(), z.unknown()).describe('Video request fields from the TaoDock model guide.'),
    },
    annotations: { openWorldHint: true },
  },
  async ({ model: modelId, request }) => {
    try {
      const model = await modelDirectory().find(modelId, 'video')
      const task = await createVideo(activeClient(), model.id, request)
      return textResult(JSON.stringify({ task_id: task.id, status: task.status }, null, 2))
    } catch (error) {
      return failed(error)
    }
  },
)

server.registerTool(
  'get_video_status',
  {
    title: 'Get video task status',
    description: 'Returns the current state of a TaoDock video task.',
    inputSchema: { task_id: z.string().trim().min(1) },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ task_id: taskId }) => {
    try {
      return textResult(JSON.stringify(await getVideo(activeClient(), taskId), null, 2))
    } catch (error) {
      return failed(error)
    }
  },
)

server.registerTool(
  'download_video',
  {
    title: 'Download a video',
    description: 'Saves a completed TaoDock video task to the configured output directory.',
    inputSchema: {
      task_id: z.string().trim().min(1),
      wait_seconds: z.number().int().min(0).max(MAX_WAIT_SECONDS).optional(),
    },
    annotations: { openWorldHint: true },
  },
  async ({ task_id: taskId, wait_seconds: waitSeconds }) => {
    try {
      const api = activeClient()
      let task = await getVideo(api, taskId)
      if (task.status !== 'completed' && task.status !== 'failed' && waitSeconds) {
        try {
          task = await waitForVideo(api, taskId, { timeoutMs: waitSeconds * 1000 })
        } catch (error) {
          if (!(error instanceof TaoDockApiError && error.kind === 'timeout')) throw error
          task = await getVideo(api, taskId)
        }
      }
      if (task.status !== 'completed') {
        const detail = task.status === 'failed' ? task.error?.message || 'generation failed' : 'try again later'
        return { isError: task.status === 'failed', content: [{ type: 'text', text: `Task ${taskId} is ${task.status}: ${detail}` }] }
      }
      const file = await output.saveResponse(task.model ?? taskId, 'mp4', await downloadVideo(api, taskId))
      return textResult(`Saved video: ${file}`)
    } catch (error) {
      return failed(error)
    }
  },
)

await server.connect(new StdioServerTransport())
