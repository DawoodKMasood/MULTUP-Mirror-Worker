import { describe, it, expect } from 'vitest'
import { OneFichierAdapter } from '../src/adapters/implementations/1fichier.js'

describe('Integration Tests - 1fichier', () => {
  const apiKey = process.env.ONEFICHIER_API_KEY

  it('should upload sample.zip file', async () => {
    const adapter = new OneFichierAdapter()
    const fs = await import('fs')
    const path = await import('path')
    const { fileURLToPath } = await import('url')
    
    const __dirname = fileURLToPath(new URL('.', import.meta.url))
    const filePath = path.resolve(__dirname, 'sample.zip')
    const fileBuffer = fs.readFileSync(filePath)
    
    const fileStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(fileBuffer))
        controller.close()
      }
    })
    
    const result = await adapter.upload(
      fileStream,
      'sample.zip',
      fileBuffer.length,
      apiKey ? { apiKey } : {}
    )
    
    expect(result.success).toBe(true)
    expect(result.downloadUrl).toBeDefined()
    console.log('Download URL:', result.downloadUrl)
  }, 120000)
})