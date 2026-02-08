import { BaseAdapter } from '../base.js'
import { logger } from '../../utils/logger.js'
import type { ServiceConfig, UploadResult } from '../../types/index.js'

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
      const apiKey =
        typeof config.apiKey === 'string' && config.apiKey.length > 0
          ? config.apiKey
          : undefined

      this.logUploadStart(filename, size)
      logger.debug('1fichier: Getting upload server', { hasApiKey: !!apiKey })

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

      const blob = await this.streamToBlob(fileStream)
      const formData = new FormData()
      formData.append('file[]', blob, filename)

      logger.debug('1fichier: Uploading file', { server: url, uploadId: id, filename })

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
} 
