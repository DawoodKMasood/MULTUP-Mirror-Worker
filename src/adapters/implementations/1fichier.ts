import { BaseAdapter } from '../base.js'
import type { ServiceConfig, UploadResult } from '../../types/index.js'

export class OneFichierAdapter extends BaseAdapter {
  readonly name = '1fichier.com'

  async upload(
    fileStream: ReadableStream<Uint8Array>,
    filename: string,
    size: number,
    config: ServiceConfig
  ): Promise<UploadResult> {
    try {
      const apiKey = config.apiKey

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
        return { success: false, error: 'Failed to get upload server' }
      }

      const { url, id } = (await uploadServerRes.json()) as { url: string; id: string }

      const blob = await this.streamToBlob(fileStream)
      const formData = new FormData()
      formData.append('file[]', blob, filename)

      const uploadRes = await this.fetchWithTimeout(
        `https://${url}/upload.cgi?id=${id}`,
        {
          method: 'POST',
          body: formData,
        },
        300000
      )

      if (!uploadRes.ok) {
        return { success: false, error: 'Failed to upload file' }
      }

      const endRes = await this.fetchWithTimeout(
        `https://${url}/end.pl?xid=${id}`,
        {
          method: 'POST',
          headers: { JSON: '1' },
        }
      )

      if (!endRes.ok) {
        return { success: false, error: 'Failed to finalize upload' }
      }

      const data = (await endRes.json()) as {
        links?: { download?: string; remove?: string }[]
      }

      const downloadUrl = this.extractValueFromPath('links.0.download', data) as string | undefined
      const deleteUrl = this.extractValueFromPath('links.0.remove', data) as string | undefined

      if (!downloadUrl) {
        return { success: false, error: 'No download URL returned' }
      }

      return {
        success: true,
        downloadUrl,
        deleteUrl,
        metadata: { server: url, id },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
} 
