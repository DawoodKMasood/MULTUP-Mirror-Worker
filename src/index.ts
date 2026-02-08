import { downloadFromS3 } from './handlers/download.js'
import { sendCallback } from './handlers/callback.js'
import { AdapterRegistry } from './adapters/registry.js'
import type { MirrorJob, MirrorResult } from './types/index.js'

export interface Env {
  API_CALLBACK_SECRET: string
  API_BASE_URL: string
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

    if (!job.jobId || !job.fileUrl || !job.service || !job.callbackUrl) {
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
      await sendCallback(job.callbackUrl, errorResult, env.API_CALLBACK_SECRET)
      return new Response('Unknown service', { status: 400 })
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

    await sendCallback(job.callbackUrl, mirrorResult, env.API_CALLBACK_SECRET)

    return new Response(JSON.stringify({ accepted: true, jobId: job.jobId }), {
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
      try {
        await sendCallback(job.callbackUrl, errorResult, env.API_CALLBACK_SECRET)
      } catch {
        // Ignore callback errors in error handler
      }
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}