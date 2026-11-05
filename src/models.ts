import { TaoDockApiError, type TaoDockClient } from './client.js'
import { TAODOCK_CATALOG } from './config.js'

export type ModelKind = 'text' | 'image' | 'video' | 'embedding' | 'rerank'
export type ImageRoute = 'images' | 'gemini-generate-content'

export interface AvailableModel {
  id: string
  owned_by?: string
  kind?: ModelKind | null
  image_route?: ImageRoute | null
  supported_endpoint_types?: string[] | null
}

export interface CatalogModel {
  model_name: string
  supported_endpoint_types?: string[] | null
  media_options?: { image?: unknown; video?: unknown } | null
  image_generation_prices?: Array<{ size?: string; price?: number }> | null
  image_feature_prices?: Array<{ price?: number }> | null
  video_resolution_price?: Record<string, number> | null
  video_feature_prices?: Array<{ price?: number }> | null
}

export interface TaoDockModel {
  id: string
  kind: ModelKind
  endpoints: string[]
  ownedBy?: string
  imageRoute?: ImageRoute
}

export interface ModelSnapshot {
  models: TaoDockModel[]
  listedIds: ReadonlySet<string>
  catalogAvailable: boolean
  loadedAt: number
}

const TEXT_ENDPOINTS = new Set(['openai', 'openai-response', 'openai-response-compact', 'anthropic'])
const KNOWN_KINDS = new Set<ModelKind>(['text', 'image', 'video', 'embedding', 'rerank'])

function priced(items: ReadonlyArray<{ price?: number }> | null | undefined): boolean {
  return (items ?? []).some((item) => typeof item.price === 'number' && item.price > 0)
}

function catalogSaysImage(model: CatalogModel | undefined): boolean {
  return Boolean(
    model?.media_options?.image != null ||
      (model?.image_generation_prices ?? []).some(
        (item) => typeof item.size === 'string' && item.size.length > 0 && typeof item.price === 'number' && item.price > 0,
      ) ||
      priced(model?.image_feature_prices),
  )
}

function catalogSaysVideo(model: CatalogModel | undefined): boolean {
  return Boolean(
    model?.media_options?.video != null ||
      Object.values(model?.video_resolution_price ?? {}).some((price) => price > 0) ||
      priced(model?.video_feature_prices),
  )
}

function routeForImage(endpoints: ReadonlySet<string>, preferred?: ImageRoute | null): ImageRoute | undefined {
  if (preferred === 'images' || preferred === 'gemini-generate-content') return preferred
  if (endpoints.has('gemini')) return 'gemini-generate-content'
  if (endpoints.has('image-generation')) return 'images'
  return undefined
}

export function classifyModels(models: readonly AvailableModel[], catalog: readonly CatalogModel[] | null): TaoDockModel[] {
  const catalogById = new Map((catalog ?? []).map((model) => [model.model_name, model]))
  const result: TaoDockModel[] = []

  for (const available of models) {
    if (!available.id) continue
    const catalogModel = catalogById.get(available.id)
    const endpoints = [...new Set([...(available.supported_endpoint_types ?? []), ...(catalogModel?.supported_endpoint_types ?? [])])]
    const endpointSet = new Set(endpoints)
    const common = {
      id: available.id,
      endpoints,
      ...(available.owned_by ? { ownedBy: available.owned_by } : {}),
    }

    if (available.kind && KNOWN_KINDS.has(available.kind)) {
      if (available.kind === 'image') {
        const imageRoute = routeForImage(endpointSet, available.image_route)
        if (imageRoute) result.push({ ...common, kind: 'image', imageRoute })
      } else {
        result.push({ ...common, kind: available.kind })
      }
      continue
    }

    if (endpointSet.has('openai-video') || catalogSaysVideo(catalogModel)) {
      result.push({ ...common, kind: 'video' })
      continue
    }
    if (endpointSet.has('image-generation') || catalogSaysImage(catalogModel)) {
      const imageRoute = routeForImage(endpointSet)
      if (imageRoute) result.push({ ...common, kind: 'image', imageRoute })
      continue
    }
    if (endpointSet.has('embeddings')) {
      result.push({ ...common, kind: 'embedding' })
      continue
    }
    if (endpointSet.has('jina-rerank')) {
      result.push({ ...common, kind: 'rerank' })
      continue
    }
    if ((available.supported_endpoint_types ?? []).some((endpoint) => TEXT_ENDPOINTS.has(endpoint))) {
      result.push({ ...common, kind: 'text' })
    }
  }

  return result
}

export async function listAvailableModels(client: TaoDockClient, signal?: AbortSignal): Promise<AvailableModel[]> {
  const response = await client.json<{ data?: AvailableModel[] }>('models?scope=authorized', {
    method: 'GET',
    ...(signal ? { signal } : {}),
  })
  return Array.isArray(response.data) ? response.data : []
}

export async function readModelCatalog(fetchImpl: typeof fetch = fetch, signal?: AbortSignal): Promise<CatalogModel[]> {
  const timeout = AbortSignal.timeout(8_000)
  const response = await fetchImpl(TAODOCK_CATALOG, {
    method: 'GET',
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  })
  if (!response.ok) {
    throw new TaoDockApiError(`TaoDock model catalog returned HTTP ${response.status}`, {
      kind: 'service',
      status: response.status,
    })
  }
  const body = (await response.json()) as { success?: boolean; data?: CatalogModel[] }
  if (body.success === false || !Array.isArray(body.data)) {
    throw new TaoDockApiError('TaoDock model catalog is unavailable', { kind: 'service' })
  }
  return body.data
}

export interface ModelDirectoryOptions {
  client: TaoDockClient
  fetch?: typeof fetch
  ttlMs?: number
  now?: () => number
}

export class ModelDirectory {
  readonly #client: TaoDockClient
  readonly #fetch: typeof fetch
  readonly #ttlMs: number
  readonly #now: () => number
  #catalog: CatalogModel[] | undefined
  #snapshot: ModelSnapshot | undefined

  constructor(options: ModelDirectoryOptions) {
    this.#client = options.client
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis)
    this.#ttlMs = options.ttlMs ?? 60 * 60 * 1000
    this.#now = options.now ?? Date.now
  }

  async load(options: { force?: boolean; signal?: AbortSignal } = {}): Promise<ModelSnapshot> {
    if (!options.force && this.#snapshot && this.#now() - this.#snapshot.loadedAt < this.#ttlMs) return this.#snapshot

    const available = await listAvailableModels(this.#client, options.signal)
    const refreshedCatalog = await readModelCatalog(this.#fetch, options.signal).catch(() => undefined)
    if (refreshedCatalog) this.#catalog = refreshedCatalog
    const catalog = refreshedCatalog ?? this.#catalog ?? null
    const snapshot: ModelSnapshot = {
      models: classifyModels(available, catalog),
      listedIds: new Set(available.map((model) => model.id)),
      catalogAvailable: catalog !== null,
      loadedAt: this.#now(),
    }
    this.#snapshot = snapshot
    return snapshot
  }

  async find(id: string, kind: ModelKind): Promise<TaoDockModel> {
    const model = (await this.load()).models.find((candidate) => candidate.id === id)
    if (model?.kind === kind) return model
    if (model) throw new TypeError(`${id} is a ${model.kind} model, not a ${kind} model`)
    throw new TypeError(`${id} is not available to this TaoDock API key`)
  }

  async isListed(id: string): Promise<boolean> {
    return (await this.load({ force: true })).listedIds.has(id)
  }
}
