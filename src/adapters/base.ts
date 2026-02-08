import { logger } from '../utils/logger.js'
import type { MirrorAdapter, UploadResult, ServiceConfig } from '../types/index.js'

export abstract class BaseAdapter implements MirrorAdapter {
  abstract readonly name: string

  abstract upload(
    fileStream: ReadableStream<Uint8Array>,
    filename: string,
    size: number,
    config: ServiceConfig
  ): Promise<UploadResult>

  async delete?(deleteUrl: string, config: ServiceConfig): Promise<boolean> {
    return false
  }

  protected async streamToBlob(stream: ReadableStream<Uint8Array>): Promise<Blob> {
    const chunks: Uint8Array[] = []
    const reader = stream.getReader()
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    
    return new Blob(chunks)
  }

  protected async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number = 30000
  ): Promise<Response> {
    logger.debug('Adapter fetch with timeout', {
      url,
      method: options.method || 'GET',
      timeoutMs,
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      logger.debug('Adapter fetch completed', {
        url,
        status: response.status,
      })
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error('Adapter fetch timeout', { url, timeoutMs })
      }
      throw error
    }
  }

  protected logUploadStart(filename: string, size: number): void {
    logger.info('Adapter upload started', {
      adapter: this.name,
      filename,
      size,
    })
  }

  protected logUploadSuccess(downloadUrl?: string, deleteUrl?: string): void {
    logger.info('Adapter upload completed successfully', {
      adapter: this.name,
      downloadUrl,
      deleteUrl,
    })
  }

  protected logUploadFailure(error: string): void {
    logger.error('Adapter upload failed', {
      adapter: this.name,
      error,
    })
  }

  protected extractValueFromPath(path: string | string[], data: unknown): unknown {
    const keys = Array.isArray(path) ? path : path.split('.')
    let current: unknown = data

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined
      }
      if (typeof current === 'object' && key in current) {
        current = (current as Record<string, unknown>)[key]
      } else if (Array.isArray(current) && !isNaN(Number(key))) {
        current = current[Number(key)]
      } else {
        return undefined
      }
    }

    return current
  }
}
