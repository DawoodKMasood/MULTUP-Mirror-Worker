export async function downloadFromS3(url: string): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(url, {
    method: 'GET',
  })

  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`)
  }

  if (!response.body) {
    throw new Error('Response body is null')
  }

  return response.body
}
