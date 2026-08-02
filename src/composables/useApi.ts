import { useProjectsStore } from '@/stores/projects'
import { createApi, unwrap, ApiError, type ApiClient } from '@/api/client'

/**
 * Access to the typed Hetzner Cloud client for the currently active project.
 * Throws ApiError('No project selected') when no project/token is active.
 */
export function useApi() {
  const store = useProjectsStore()

  function client(): ApiClient {
    const token = store.activeProject?.token
    if (!token) throw new ApiError('No project selected', 0)
    return createApi(token)
  }

  return { client, unwrap, hasProject: () => !!store.activeProject }
}

export { ApiError, unwrap }
export type { ApiClient }
