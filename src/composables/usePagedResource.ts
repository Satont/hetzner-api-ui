import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { ApiError } from '@/api/client'

export interface PageInfo {
  page: number
  per_page: number
  last_page: number
  total_entries: number | null
}

interface RawPagination {
  page?: number
  per_page?: number
  previous_page?: number | null
  next_page?: number | null
  last_page?: number | null
  total_entries?: number | null
}

/**
 * Generic paged list loader for Hetzner list endpoints.
 *
 * `loader` receives { page, per_page } and must return the raw `meta.pagination`
 * object plus the extracted items, e.g.:
 *
 *   const { items, ... } = usePagedResource(async ({ page, per_page }) => {
 *     const data = unwrap(await client().GET('/ssh_keys', { params: { query: { page, per_page } } }))
 *     return { items: data.ssh_keys, pagination: data.meta?.pagination ?? {} }
 *   })
 */
export function usePagedResource<T>(
  loader: (params: { page: number; per_page: number }) => Promise<{
    items: T[]
    pagination: RawPagination
  }>,
  options: { perPage?: number; auto?: boolean } = {},
) {
  const items = ref<T[]>([]) as import('vue').Ref<T[]>
  const loading = ref(false)
  const error = ref<string | null>(null)
  const page = ref(1)
  const perPage = ref(options.perPage ?? 25)
  const pageInfo = ref<PageInfo>({ page: 1, per_page: perPage.value, last_page: 1, total_entries: null })

  async function reload(targetPage?: number) {
    if (targetPage !== undefined) page.value = targetPage
    loading.value = true
    error.value = null
    try {
      const result = await loader({ page: page.value, per_page: perPage.value })
      items.value = result.items
      const p = result.pagination
      pageInfo.value = {
        page: p.page ?? page.value,
        per_page: p.per_page ?? perPage.value,
        last_page: p.last_page ?? (p.next_page ? page.value + 1 : page.value),
        total_entries: p.total_entries ?? null,
      }
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : String(e)
      items.value = []
    } finally {
      loading.value = false
    }
  }

  if (options.auto !== false) void reload()

  return { items, loading, error, page, perPage, pageInfo, reload }
}

/** Runs an API mutation with sonner toast feedback. Returns undefined on failure. */
export async function runAction<T>(fn: () => Promise<T>, successMessage?: string): Promise<T | undefined> {
  try {
    const result = await fn()
    if (successMessage) toast.success(successMessage)
    return result
  } catch (e) {
    toast.error(e instanceof ApiError ? e.message : String(e))
    return undefined
  }
}
