import assert from 'node:assert/strict'
import test from 'node:test'

import { classifyModels } from '../src/models.js'

test('classifyModels uses declared endpoint capabilities', () => {
  const models = classifyModels(
    [
      { id: 'paint-a', supported_endpoint_types: ['image-generation'] },
      { id: 'movie-a', supported_endpoint_types: ['openai-video'] },
      { id: 'words-a', supported_endpoint_types: ['openai'] },
      { id: 'vectors-a', supported_endpoint_types: ['embeddings'] },
    ],
    [],
  )
  assert.deepEqual(
    models.map(({ id, kind }) => ({ id, kind })),
    [
      { id: 'paint-a', kind: 'image' },
      { id: 'movie-a', kind: 'video' },
      { id: 'words-a', kind: 'text' },
      { id: 'vectors-a', kind: 'embedding' },
    ],
  )
})

test('catalog metadata distinguishes Gemini image models', () => {
  const models = classifyModels(
    [
      { id: 'gemini-picture', supported_endpoint_types: ['gemini'] },
      { id: 'gemini-words', supported_endpoint_types: ['gemini'] },
    ],
    [{ model_name: 'gemini-picture', media_options: { image: {} }, supported_endpoint_types: ['gemini'] }],
  )
  assert.equal(models.length, 1)
  assert.equal(models[0]?.kind, 'image')
  assert.equal(models[0]?.imageRoute, 'gemini-generate-content')
})

test('an explicit kind is honored', () => {
  const models = classifyModels(
    [{ id: 'private-picture', kind: 'image', image_route: 'images', supported_endpoint_types: [] }],
    null,
  )
  assert.deepEqual(models, [
    { id: 'private-picture', kind: 'image', imageRoute: 'images', endpoints: [] },
  ])
})
