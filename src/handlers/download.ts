import { logger } from '../utils/logger.js'

export async function downloadFromS3(url: string): Promise<ReadableStream<Uint8Array>> {
  logger.info('S3 download started', { url })
  const startTime = Date.now()

  try {
    const response = await fetch(url, {
      method: 'GET',
    })

    if (!response.ok) {
      logger.error('S3 download failed', {
        url,
        status: response.status,
        statusText: response.statusText,
      })
      throw new Error(`Failed to download: ${response.status} ${response.statusText}`)
    }

    if (!response.body) {
      logger.error('S3 download failed: Response body is null', { url })
      throw new Error('Response body is null')
    }

    const contentLength = response.headers.get('content-length')
    const bytesDownloaded = contentLength ? parseInt(contentLength, 10) : undefined
    const duration = Date.now() - startTime

    logger.info('S3 download completed', {
      url,
      bytesDownloaded,
      durationMs: duration,
    })

    return response.body
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('S3 download error', {
      url,
      durationMs: duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}
