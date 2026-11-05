import { randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'

const EXTENSIONS: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
}

export function extensionFor(mimeType: string | null | undefined, fallback: string): string {
  const normalized = mimeType?.split(';', 1)[0]?.trim().toLowerCase()
  return (normalized && EXTENSIONS[normalized]) || fallback
}

function safeStem(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/gu, '-').replace(/^-+|-+$/gu, '') || 'taodock-output'
}

export class OutputDirectory {
  readonly root: string

  constructor(root: string) {
    this.root = path.resolve(root)
  }

  #path(stem: string, extension: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/gu, '-')
    return path.join(this.root, `${safeStem(stem)}-${timestamp}-${randomUUID().slice(0, 8)}.${extension}`)
  }

  async saveBytes(stem: string, extension: string, bytes: Uint8Array): Promise<string> {
    await mkdir(this.root, { recursive: true })
    const destination = this.#path(stem, extension)
    await writeFile(destination, bytes)
    return destination
  }

  async saveResponse(stem: string, fallbackExtension: string, response: Response): Promise<string> {
    if (!response.body) throw new Error('The downloaded file is empty')
    await mkdir(this.root, { recursive: true })
    const destination = this.#path(stem, extensionFor(response.headers.get('content-type'), fallbackExtension))
    await pipeline(Readable.fromWeb(response.body as WebReadableStream<Uint8Array>), createWriteStream(destination))
    return destination
  }
}
