import assert from 'node:assert/strict'
import test from 'node:test'

import { TaoDockClient } from '../src/client.js'
import { createVideo, generateImage } from '../src/media.js'
import type { TaoDockModel } from '../src/models.js'

function clientWith(handler: (request: Request) => Response | Promise<Response>): TaoDockClient {
  return new TaoDockClient({
    apiKey: 'test-key',
    pluginVersion: '0.0.0-test',
    baseUrl: 'https://api.example.test/v1',
    fetch: async (input, init) => handler(new Request(input, init)),
  })
}

test('generateImage keeps the selected model and prompt authoritative', async () => {
  let body: Record<string, unknown> | undefined
  const client = clientWith(async (request) => {
    body = (await request.json()) as Record<string, unknown>
    return Response.json({ data: [{ b64_json: 'aW1hZ2U=' }] })
  })
  const model: TaoDockModel = { id: 'paint-safe', kind: 'image', imageRoute: 'images', endpoints: ['image-generation'] }

  await generateImage(client, {
    model,
    prompt: 'trusted prompt',
    parameters: { model: 'replaced-model', prompt: 'replaced prompt', size: '1024x1024' },
  })

  assert.equal(body?.model, 'paint-safe')
  assert.equal(body?.prompt, 'trusted prompt')
  assert.equal(body?.size, '1024x1024')
})

test('generateImage always builds Gemini contents from the prompt', async () => {
  let body: Record<string, unknown> | undefined
  const client = clientWith(async (request) => {
    body = (await request.json()) as Record<string, unknown>
    return Response.json({ candidates: [{ content: { parts: [{ inlineData: { data: 'aW1hZ2U=', mimeType: 'image/png' } }] } }] })
  })
  const model: TaoDockModel = { id: 'gemini-picture', kind: 'image', imageRoute: 'gemini-generate-content', endpoints: ['gemini'] }

  await generateImage(client, {
    model,
    prompt: 'trusted prompt',
    parameters: { contents: [{ role: 'user', parts: [{ text: 'replaced prompt' }] }], temperature: 0.2 },
  })

  assert.deepEqual(body?.contents, [{ role: 'user', parts: [{ text: 'trusted prompt' }] }])
  assert.equal(body?.temperature, 0.2)
})

test('createVideo keeps the selected model authoritative', async () => {
  let body: Record<string, unknown> | undefined
  const client = clientWith(async (request) => {
    body = (await request.json()) as Record<string, unknown>
    return Response.json({ id: 'task-1', status: 'queued' })
  })

  await createVideo(client, 'movie-safe', { model: 'replaced-model', prompt: 'hello' })
  assert.equal(body?.model, 'movie-safe')
  assert.equal(body?.prompt, 'hello')
})
