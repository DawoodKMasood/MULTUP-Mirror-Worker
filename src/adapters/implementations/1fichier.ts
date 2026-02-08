import { BaseAdapter } from '../base.js'
import { logger } from '../../utils/logger.js'
import type { ServiceConfig, UploadResult } from '../../types/index.js'

const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB chunks

export class OneFichierAdapter extends BaseAdapter {
  readonly name = '1fichier.com'

  async upload(
    fileStream: ReadableStream<Uint8Array>,
    filename: string,
    size: number,
    config: ServiceConfig
  ): Promise<UploadResult> {
    this.logUploadStart(filename, size)
    const startTime = Date.now()

    try {
      const apiKey = config.apiKey

      this.logUploadStart(filename, size)
      logger.debug('1fichier: Getting upload server', { hasApiKey: !!apiKey, size })

      const uploadServerRes = await this.fetchWithTimeout(
        'https://api.1fichier.com/v1/upload/get_upload_server.cgi',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': '*',
            ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
          },
        }
      )

      if (!uploadServerRes.ok) {
        const error = 'Failed to get upload server'
        this.logUploadFailure(error)
        return { success: false, error }
      }

      const { url, id } = (await uploadServerRes.json()) as { url: string; id: string }
      logger.debug('1fichier: Got upload server', { server: url, uploadId: id })

      // Convert stream to blob for processing
      const blob = await this.streamToBlob(fileStream)

      // Use chunked upload for files larger than CHUNK_SIZE
      if (size > CHUNK_SIZE) {
        logger.debug('1fichier: Using chunked upload', { size, chunkSize: CHUNK_SIZE })
        await this.uploadChunks(blob, filename, url, id, apiKey, size)
      } else {
        // Simple upload for smaller files
        logger.debug('1fichier: Using simple upload', { size })
        const formData = new FormData()
        formData.append('file[]', blob, filename)

        const uploadRes = await this.fetchWithTimeout(
          `https://${url}/upload.cgi?id=${id}`,
          {
            method: 'POST',
            headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
            body: formData,
          },
          300000
        )

        if (!uploadRes.ok) {
          const error = 'Failed to upload file'
          this.logUploadFailure(error)
          return { success: false, error }
        }
      }

      logger.debug('1fichier: Finalizing upload', { server: url, uploadId: id })

      const endRes = await this.fetchWithTimeout(
        `https://${url}/end.pl?xid=${id}`,
        {
          method: 'POST',
          headers: { JSON: '1' },
        }
      )

      if (!endRes.ok) {
        const error = 'Failed to finalize upload'
        this.logUploadFailure(error)
        return { success: false, error }
      }

      const data = (await endRes.json()) as {
        links?: { download?: string; remove?: string }[]
      }

      const downloadUrl = this.extractValueFromPath('links.0.download', data) as string | undefined

      if (!downloadUrl) {
        const error = 'No download URL returned'
        this.logUploadFailure(error)
        return { success: false, error }
      }

      const duration = Date.now() - startTime
      this.logUploadSuccess(downloadUrl)
      logger.info('1fichier: Upload completed', { durationMs: duration, uploadId: id })

      return {
        success: true,
        downloadUrl,
        metadata: { server: url, id },
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logUploadFailure(errorMessage)
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  private async uploadChunks(
    blob: Blob,
    filename: string,
    serverUrl: string,
    uploadId: string,
    apiKey: string | undefined,
    totalSize: number
  ): Promise<void> {
    const totalChunks = Math.ceil(blob.size / CHUNK_SIZE)
    logger.debug('1fichier: Starting chunked upload', { totalChunks, totalSize })

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, blob.size)
      const chunk = blob.slice(start, end)

      // up.pl expects 1-indexed chunk numbers (up2, up3, etc. based on trace)
      const chunkNumber = chunkIndex + 2
      const chunkUrl = `https://${serverUrl}/up.pl?X-Id=${uploadId}&n=up${chunkNumber}`

      logger.debug('1fichier: Uploading chunk', {
        chunk: chunkIndex + 1,
        totalChunks,
        chunkSize: chunk.size,
      })

      const formData = new FormData()
      formData.append('file[]', chunk, filename)

      const chunkRes = await this.fetchWithTimeout(
        chunkUrl,
        {
          method: 'POST',
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
          body: formData,
        },
        300000
      )

      if (!chunkRes.ok) {
        throw new Error(`Failed to upload chunk ${chunkIndex + 1}: ${chunkRes.status}`)
      }

      logger.debug('1fichier: Chunk uploaded successfully', { chunk: chunkIndex + 1 })
    }

    logger.debug('1fichier: All chunks uploaded', { totalChunks })
  }
} 
