import { downloadFromS3 } from './handlers/download.js'
import { AdapterRegistry } from './adapters/registry.js'
import { logger } from './utils/logger'
import type { MirrorJob, MirrorResult } from './types/index.js'

export interface Env {
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    logger.info('Incoming request', { method: request.method, url: request.url })

    if (request.method !== 'POST') {
      logger.warn('Method not allowed', { method: request.method })
      return new Response('Method not allowed', { status: 405 })
    }

    const url = new URL(request.url)

    if (url.pathname === '/mirror') {
      return handleMirror(request, env)
    }

    logger.warn('Not found', { pathname: url.pathname })
    return new Response('Not found', { status: 404 })
  },
}

async function handleMirror(request: Request, env: Env): Promise<Response> {
  let job: MirrorJob | undefined
  const startTime = Date.now()

  try {
    job = (await request.json()) as MirrorJob

    logger.setContext({ jobId: job.jobId, fileId: job.fileId, service: job.service })
    logger.info('Mirror job started', { filename: job.filename, size: job.size })

    if (!job.jobId || !job.fileId || !job.fileUrl || !job.service) {
      logger.warn('Validation failed: Missing required fields', {
        hasJobId: !!job.jobId,
        hasFileId: !!job.fileId,
        hasFileUrl: !!job.fileUrl,
        hasService: !!job.service,
      })
      return new Response('Missing required fields', { status: 400 })
    }

    const adapter = AdapterRegistry.get(job.service)

    if (!adapter) {
      logger.error('Unknown service', { service: job.service })
      const errorResult: MirrorResult = {
        jobId: job.jobId,
        fileId: job.fileId,
        service: job.service,
        success: false,
        error: `Unknown service: ${job.service}`,
      }
      return new Response(JSON.stringify(errorResult), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const fileStream = await downloadFromS3(job.fileUrl)

    const uploadResult = await adapter.upload(
      fileStream,
      job.filename,
      job.size,
      job.serviceConfig
    )

    const duration = Date.now() - startTime
    const mirrorResult: MirrorResult = {
      jobId: job.jobId,
      fileId: job.fileId,
      service: job.service,
      success: uploadResult.success,
      downloadUrl: uploadResult.downloadUrl,
      deleteUrl: uploadResult.deleteUrl,
      error: uploadResult.error,
      metadata: uploadResult.metadata,
    }

    if (uploadResult.success) {
      logger.info('Mirror job completed successfully', {
        durationMs: duration,
        downloadUrl: uploadResult.downloadUrl,
      })
    } else {
      logger.error('Mirror job failed', {
        durationMs: duration,
        error: uploadResult.error,
      })
    }

    return new Response(JSON.stringify(mirrorResult), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    logger.error('Mirror job error', {
      durationMs: duration,
      error: errorMessage,
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
    })

    if (job) {
      const errorResult: MirrorResult = {
        jobId: job.jobId,
        fileId: job.fileId,
        service: job.service,
        success: false,
        error: errorMessage,
      }
      return new Response(JSON.stringify(errorResult), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  } finally {
    logger.clearContext()
  }
}