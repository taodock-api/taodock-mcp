import { apiBaseUrl } from './config.js'

export type ApiFailureKind =
  | 'unauthorized'
  | 'insufficient_quota'
  | 'model_not_found'
  | 'unsupported_endpoint'
  | 'rate_limited'
  | 'timeout'
  | 'network'
  | 'service'

export class TaoDockApiError extends Error {
  readonly kind: ApiFailureKind
  readonly status: number | undefined
  readonly code: string | undefined
  readonly requestId: string | undefined
  readonly retryAfterSeconds: number | undefined

  constructor(
    message: string,
    details: {
      kind: ApiFailureKind
      status?: number
      code?: string
      requestId?: string
      retryAfterSeconds?: number
      cause?: unknown
    },
  ) {
    super(message, details.cause === undefined ? undefined : { cause: details.cause })
    this.name = 'TaoDockApiError'
    this.kind = details.kind
    this.status = details.status
    this.code = details.code
    this.requestId = details.requestId
    this.retryAfterSeconds = details.retryAfterSeconds
  }
}

function failureKind(status: number, code?: string): ApiFailureKind {
  if (code === 'insufficient_user_quota') return 'insufficient_quota'
  if (code === 'model_not_found') return 'model_not_found'
  if (code === 'unsupported_endpoint') return 'unsupported_endpoint'
  if (code === 'rate_limit_exceeded') return 'rate_limited'
  if (status === 401) return 'unauthorized'
  if (status === 429) return 'rate_limited'
  return 'service'
}

async function apiError(response: Response): Promise<TaoDockApiError> {
  let message = response.statusText || `HTTP ${response.status}`
  let code: string | undefined
  try {
    const body = (await response.json()) as { error?: { message?: unknown; code?: unknown }; message?: unknown }
    if (typeof body.error?.message === 'string') message = body.error.message
    else if (typeof body.message === 'string') message = body.message
    if (typeof body.error?.code === 'string' && body.error.code) code = body.error.code
  } catch {
    // Non-JSON errors retain the HTTP status text.
  }

  let requestId = response.headers.get('x-request-id') ?? undefined
  const suffix = /\s*\(request id: ([^)]+)\)\s*$/u.exec(message)
  if (suffix) {
    requestId = suffix[1]
    message = message.slice(0, suffix.index)
  }
  const retryHeader = response.headers.get('retry-after')
  const retryValue = retryHeader === null ? Number.NaN : Number(retryHeader)
  const retryAfterSeconds = Number.isFinite(retryValue) && retryValue >= 0 ? retryValue : undefined

  return new TaoDockApiError(message, {
    kind: failureKind(response.status, code),
    status: response.status,
    ...(code ? { code } : {}),
    ...(requestId ? { requestId } : {}),
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
  })
}

export interface TaoDockClientOptions {
  apiKey: string
  pluginVersion: string
  baseUrl?: string
  fetch?: typeof fetch
  timeoutMs?: number
}

export class TaoDockClient {
  readonly baseUrl: string
  readonly #apiKey: string
  readonly #fetch: typeof fetch
  readonly #timeoutMs: number
  readonly #attribution: string

  constructor(options: TaoDockClientOptions) {
    const apiKey = options.apiKey.trim()
    if (!apiKey) throw new TaoDockApiError('A TaoDock API key is required', { kind: 'unauthorized' })
    this.#apiKey = apiKey
    this.baseUrl = apiBaseUrl(options.baseUrl)
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis)
    this.#timeoutMs = options.timeoutMs ?? 120_000
    this.#attribution = `taodock-mcp/${options.pluginVersion}`
  }

  async request(path: string, options: RequestInit & { timeoutMs?: number; json?: unknown } = {}): Promise<Response> {
    const { headers, timeoutMs, json, signal, ...init } = options
    const finalHeaders = new Headers(headers)
    finalHeaders.set('Authorization', `Bearer ${this.#apiKey}`)
    finalHeaders.set('X-TaoDock-Plugin', this.#attribution)
    let body = init.body
    if (json !== undefined) {
      body = JSON.stringify(json)
      finalHeaders.set('Content-Type', 'application/json')
    }
    const deadline = AbortSignal.timeout(timeoutMs ?? this.#timeoutMs)
    const combinedSignal = signal ? AbortSignal.any([signal, deadline]) : deadline

    let response: Response
    try {
      response = await this.#fetch(`${this.baseUrl}/${path.replace(/^\/+/, '')}`, {
        ...init,
        headers: finalHeaders,
        ...(body === null || body === undefined ? {} : { body }),
        signal: combinedSignal,
      })
    } catch (error) {
      if (signal?.aborted) throw error
      const timedOut = deadline.aborted
      throw new TaoDockApiError(timedOut ? 'The TaoDock request timed out' : 'Could not reach TaoDock', {
        kind: timedOut ? 'timeout' : 'network',
        cause: error,
      })
    }
    if (!response.ok) throw await apiError(response)
    return response
  }

  async json<T>(path: string, options: RequestInit & { timeoutMs?: number; json?: unknown } = {}): Promise<T> {
    return (await (await this.request(path, options)).json()) as T
  }
}
