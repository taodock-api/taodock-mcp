import assert from 'node:assert/strict'
import test from 'node:test'

import { apiBaseUrl, modelGuide, registrationUrl } from '../src/config.js'

test('apiBaseUrl normalizes valid values', () => {
  assert.equal(apiBaseUrl(), 'https://taodock.com/v1')
  assert.equal(apiBaseUrl(' https://example.test/custom///?ignored=yes#fragment '), 'https://example.test/custom')
  assert.equal(apiBaseUrl('https://example.test'), 'https://example.test/v1')
})

test('apiBaseUrl rejects unsafe protocols', () => {
  assert.throws(() => apiBaseUrl('file:///tmp/service'), /Invalid TaoDock API base URL/u)
})

test('TaoDock links are deterministic', () => {
  assert.equal(modelGuide('en'), 'https://docs.taodock.com/en/guide/models.html')
  assert.equal(modelGuide('zh'), 'https://docs.taodock.com/guide/models.html')
  const signup = new URL(registrationUrl('mcp-registry'))
  assert.equal(signup.origin, 'https://taodock.com')
  assert.equal(signup.searchParams.get('utm_source'), 'mcp-registry')
})
