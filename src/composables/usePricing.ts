import { ref } from 'vue'
import { useApi } from '@/composables/useApi'
import { useProjectsStore } from '@/stores/projects'
import type { ResponseItem } from '@/api/client'
import type { operations } from '@/api/schema'

export type Pricing = ResponseItem<operations['get_pricing'], 'pricing'>

// /pricing is identical for every call within a project token — cache it.
const cache = new Map<string, Pricing>()
const inFlight = new Map<string, Promise<Pricing | undefined>>()

/**
 * Lazily fetches and caches GET /pricing for the active project.
 * Safe to call from multiple components — requests are deduped.
 */
export function usePricing() {
  const { client, unwrap } = useApi()
  const store = useProjectsStore()

  const pricing = ref<Pricing | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load(): Promise<Pricing | undefined> {
    const token = store.activeProject?.token
    if (!token) return undefined

    const cached = cache.get(token)
    if (cached) {
      pricing.value = cached
      return cached
    }

    loading.value = true
    error.value = null
    let promise = inFlight.get(token)
    if (!promise) {
      promise = (async () => {
        try {
          const data = unwrap(await client().GET('/pricing'))
          const value = data.pricing
          if (value) cache.set(token, value)
          return value
        } catch {
          return undefined
        }
      })()
      inFlight.set(token, promise)
    }

    const value = await promise
    inFlight.delete(token)
    loading.value = false
    if (value === undefined) error.value = 'Failed to load pricing.'
    else pricing.value = value
    return value
  }

  return { pricing, loading, error, load }
}
