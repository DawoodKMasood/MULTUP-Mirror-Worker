export interface MirrorJob {
  jobId: string
  fileId: string
  fileUrl: string
  filename: string
  size: number
  service: string
  serviceConfig: ServiceConfig
}

export interface ServiceConfig {
  apiKey?: string
  baseUrl?: string
  customHeaders?: Record<string, string>
  [key: string]: unknown
}

export interface MirrorResult {
  jobId: string
  fileId: string
  service: string
  success: boolean
  downloadUrl?: string
  deleteUrl?: string
  error?: string
  metadata?: Record<string, unknown>
}

export interface UploadResult {
  success: boolean
  downloadUrl?: string
  deleteUrl?: string
  metadata?: Record<string, unknown>
  error?: string
}

export interface MirrorAdapter {
  name: string
  upload(
    fileStream: ReadableStream<Uint8Array>,
    filename: string,
    size: number,
    config: ServiceConfig
  ): Promise<UploadResult>
  delete?(deleteUrl: string, config: ServiceConfig): Promise<boolean>
}
