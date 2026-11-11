export const TAODOCK_SITE = 'https://taodock.com'
export const TAODOCK_API = `${TAODOCK_SITE}/v1`
export const TAODOCK_CATALOG = `${TAODOCK_SITE}/api/pricing`
export const TAODOCK_KEYS = `${TAODOCK_SITE}/keys`
export const TAODOCK_WALLET = `${TAODOCK_SITE}/wallet`
export const TAODOCK_MODELS = `${TAODOCK_SITE}/models`
export const TAODOCK_DOCS = 'https://docs.taodock.com'

export function apiBaseUrl(value?: string): string {
  const configured = value?.trim()
  if (!configured) return TAODOCK_API

  let url: URL
  try {
    url = new URL(configured)
  } catch {
    throw new TypeError(`Invalid TaoDock API base URL: ${configured}`)
  }
  if (url.protocol !== 'https:') {
    throw new TypeError(`TaoDock API base URL must use HTTPS: ${configured}`)
  }
  if (url.username || url.password) {
    throw new TypeError(`TaoDock API base URL must not contain credentials: ${configured}`)
  }
  url.search = ''
  url.hash = ''
  const path = url.pathname.replace(/\/+$/u, '')
  url.pathname = path || '/v1'
  return url.toString().replace(/\/+$/u, '')
}

export function registrationUrl(source: string): string {
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/u.test(source)) {
    throw new TypeError('Invalid acquisition source')
  }
  const url = new URL('/sign-up', TAODOCK_SITE)
  url.searchParams.set('utm_source', source)
  url.searchParams.set('utm_medium', 'plugin')
  url.searchParams.set('utm_campaign', 'integrations')
  return url.toString()
}

export function modelGuide(locale: 'en' | 'zh'): string {
  return `${TAODOCK_DOCS}${locale === 'zh' ? '/guide/models.html' : '/en/guide/models.html'}`
}
