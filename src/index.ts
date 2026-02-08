import { downloadFromS3 } from './handlers/download.js'
import { AdapterRegistry } from './adapters/registry.js'
import type { MirrorJob, MirrorResult } from './types/index.js'

export interface Env {
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    const url = new URL(request.url)

    if (url.pathname === '/mirror') {
      return handleMirror(request, env)
    }

    return new Response('Not found', { status: 404 })
  },
}

async function handleMirror(request: Request, env: Env): Promise<Response> {
  let job: MirrorJob | undefined

  try {
    job = (await request.json()) as MirrorJob

    if (!job.jobId || !job.fileId || !job.fileUrl || !job.service) {
      return new Response('Missing required fields', { status: 400 })
    }

    const adapter = AdapterRegistry.get(job.service)

    if (!adapter) {
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

    return new Response(JSON.stringify(mirrorResult), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

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
  }
}