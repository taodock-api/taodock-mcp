import assert from 'node:assert/strict'
import test from 'node:test'

import { apiBaseUrl, modelGuide, registrationUrl } from '../src/config.js'

test('apiBaseUrl normalizes valid values', () => {
  assert.equal(apiBaseUrl(), 'https://taodock.com/v1')
  assert.equal(apiBaseUrl(' https://example.test/custom///?ignored=yes#fragment '), 'https://example.test/custom')
  assert.equal(apiBaseUrl('https://example.test'), 'https://example.test/v1')
})

test('apiBaseUrl rejects unsafe protocols and embedded credentials', () => {
  assert.throws(() => apiBaseUrl('file:///tmp/service'), /must use HTTPS/u)
  assert.throws(() => apiBaseUrl('http://localhost:8080/v1'), /must use HTTPS/u)
  assert.throws(() => apiBaseUrl('https://user:password@example.test/v1'), /must not contain credentials/u)
})

test('TaoDock links are deterministic', () => {
  assert.equal(modelGuide('en'), 'https://docs.taodock.com/en/guide/models.html')
  assert.equal(modelGuide('zh'), 'https://docs.taodock.com/guide/models.html')
  const signup = new URL(registrationUrl('mcp-registry'))
  assert.equal(signup.origin, 'https://taodock.com')
  assert.equal(signup.searchParams.get('utm_source'), 'mcp-registry')
})
