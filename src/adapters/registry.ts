import type { MirrorAdapter } from '../types/index.js'
import { OneFichierAdapter } from './implementations/1fichier.js'

export class AdapterRegistry {
  private static adapters = new Map<string, MirrorAdapter>()

  static {
    AdapterRegistry.register(new OneFichierAdapter())
  }

  static register(adapter: MirrorAdapter): void {
    AdapterRegistry.adapters.set(adapter.name, adapter)
  }

  static get(name: string): MirrorAdapter | undefined {
    return AdapterRegistry.adapters.get(name)
  }

  static has(name: string): boolean {
    return AdapterRegistry.adapters.has(name)
  }

  static list(): string[] {
    return Array.from(AdapterRegistry.adapters.keys())
  }
} 
