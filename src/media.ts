import { TaoDockApiError, type TaoDockClient } from './client.js'
import type { TaoDockModel } from './models.js'

export interface GeneratedImage {
  base64?: string
  url?: string
  mimeType?: string
  revisedPrompt?: string
}

interface ImagesResponse {
  data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: { data?: string; mimeType?: string }
        inline_data?: { data?: string; mime_type?: string }
      }>
    }
  }>
}

function parseImages(body: ImagesResponse): GeneratedImage[] {
  return (body.data ?? []).flatMap((item) => {
    if (!item.b64_json && !item.url) return []
    return [
      {
        ...(item.b64_json ? { base64: item.b64_json } : {}),
        ...(item.url ? { url: item.url } : {}),
        ...(item.revised_prompt ? { revisedPrompt: item.revised_prompt } : {}),
      },
    ]
  })
}

function parseGeminiImages(body: GeminiResponse): GeneratedImage[] {
  const images: GeneratedImage[] = []
  for (const candidate of body.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      const base64 = part.inlineData?.data ?? part.inline_data?.data
      if (!base64) continue
      const mimeType = part.inlineData?.mimeType ?? part.inline_data?.mime_type
      images.push({ base64, ...(mimeType ? { mimeType } : {}) })
    }
  }
  return images
}

export interface GenerateImageOptions {
  model: TaoDockModel
  prompt: string
  parameters?: Record<string, unknown>
  edit?: boolean
  signal?: AbortSignal
}

export async function generateImage(client: TaoDockClient, options: GenerateImageOptions): Promise<GeneratedImage[]> {
  const { model, prompt, parameters = {}, edit = false, signal } = options
  if (model.kind !== 'image' || !model.imageRoute) throw new TypeError(`${model.id} is not an image model`)
  if (edit && model.imageRoute !== 'images') throw new TypeError(`${model.id} does not support the image edits route`)

  let images: GeneratedImage[]
  if (model.imageRoute === 'gemini-generate-content') {
    const { contents: _ignoredContents, model: _ignoredModel, ...safeParameters } = parameters
    const response = await client.json<GeminiResponse>(`models/${encodeURIComponent(model.id)}:generateContent`, {
      method: 'POST',
      json: {
        ...safeParameters,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      },
      ...(signal ? { signal } : {}),
    })
    images = parseGeminiImages(response)
  } else {
    const { model: _ignoredModel, prompt: _ignoredPrompt, ...safeParameters } = parameters
    const response = await client.json<ImagesResponse>(edit ? 'images/edits' : 'images/generations', {
      method: 'POST',
      json: { ...safeParameters, model: model.id, prompt },
      ...(signal ? { signal } : {}),
    })
    images = parseImages(response)
  }

  if (images.length === 0) {
    throw new TaoDockApiError(`${model.id} returned no image`, { kind: 'service' })
  }
  return images
}

export type VideoStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | (string & {})

export interface VideoTask {
  id: string
  status: VideoStatus
  model?: string
  progress?: number
  error?: { message?: string; code?: string }
}

interface VideoResponse {
  id?: string
  task_id?: string
  status?: string
  model?: string
  progress?: number
  error?: { message?: string; code?: string } | null
}

function videoTask(body: VideoResponse): VideoTask {
  const id = body.id || body.task_id
  if (!id) throw new TaoDockApiError('TaoDock returned a video task without an ID', { kind: 'service' })
  return {
    id,
    status: body.status ?? 'queued',
    ...(body.model ? { model: body.model } : {}),
    ...(typeof body.progress === 'number' ? { progress: body.progress } : {}),
    ...(body.error ? { error: body.error } : {}),
  }
}

export async function createVideo(
  client: TaoDockClient,
  model: string,
  request: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<VideoTask> {
  const { model: _ignoredModel, ...safeRequest } = request
  return videoTask(
    await client.json<VideoResponse>('videos', {
      method: 'POST',
      json: { ...safeRequest, model },
      ...(signal ? { signal } : {}),
    }),
  )
}

export async function getVideo(client: TaoDockClient, id: string, signal?: AbortSignal): Promise<VideoTask> {
  return videoTask(
    await client.json<VideoResponse>(`videos/${encodeURIComponent(id)}`, {
      method: 'GET',
      ...(signal ? { signal } : {}),
    }),
  )
}

function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason)
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export async function waitForVideo(
  client: TaoDockClient,
  id: string,
  options: { timeoutMs?: number; intervalMs?: number; signal?: AbortSignal } = {},
): Promise<VideoTask> {
  const deadline = Date.now() + (options.timeoutMs ?? 30 * 60 * 1000)
  for (;;) {
    const task = await getVideo(client, id, options.signal)
    if (task.status === 'completed') return task
    if (task.status === 'failed') {
      throw new TaoDockApiError(task.error?.message || `Video task ${id} failed`, {
        kind: 'service',
        ...(task.error?.code ? { code: task.error.code } : {}),
      })
    }
    if (Date.now() >= deadline) throw new TaoDockApiError(`Video task ${id} did not finish in time`, { kind: 'timeout' })
    await pause(options.intervalMs ?? 5_000, options.signal)
  }
}

export async function downloadVideo(client: TaoDockClient, id: string, signal?: AbortSignal): Promise<Response> {
  return client.request(`videos/${encodeURIComponent(id)}/content`, {
    method: 'GET',
    timeoutMs: 10 * 60 * 1000,
    ...(signal ? { signal } : {}),
  })
}
