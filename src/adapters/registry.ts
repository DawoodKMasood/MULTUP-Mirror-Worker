import type { MirrorAdapter } from '../types/index.js'
import { OneFichierAdapter } from './implementations/1fichier.js'

export class AdapterRegistry {
  private static adapters: Map<string, MirrorAdapter> | null = null

  private static ensureInitialized(): Map<string, MirrorAdapter> {
    if (!this.adapters) {
      this.adapters = new Map<string, MirrorAdapter>()
      this.register(new OneFichierAdapter())
    }
    return this.adapters
  }

  static register(adapter: MirrorAdapter): void {
    this.ensureInitialized().set(adapter.name, adapter)
  }

  static get(name: string): MirrorAdapter | undefined {
    return this.ensureInitialized().get(name)
  }

  static has(name: string): boolean {
    return this.ensureInitialized().has(name)
  }

  static list(): string[] {
    return Array.from(this.ensureInitialized().keys())
  }
} 
