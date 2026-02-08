import type { MirrorResult } from '../types/index.js'

export async function sendCallback(callbackUrl: string, result: MirrorResult, secret: string): Promise<void> {
  const response = await fetch(callbackUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Callback-Secret': secret,
    },
    body: JSON.stringify(result),
  })

  if (!response.ok) {
    throw new Error(`Callback failed: ${response.status} ${response.statusText}`)
  }
}
