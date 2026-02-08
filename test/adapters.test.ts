import { describe, it, expect } from 'vitest'
import { OneFichierAdapter } from '../src/adapters/implementations/1fichier.js'

describe('OneFichierAdapter', () => {
  it('should have correct name', () => {
    const adapter = new OneFichierAdapter()
    expect(adapter.name).toBe('1fichier.com')
  })
})
