import createClient from 'openapi-fetch'
import type { paths } from './schema'

export const API_BASE = 'https://api.hetzner.cloud/v1'

export type ApiClient = ReturnType<typeof createApi>

export function createApi(token: string) {
  return createClient<paths>({
    baseUrl: API_BASE,
    headers: { Authorization: `Bearer ${token}` },
  })
}

/** Normalized API error thrown by `unwrap`. */
export class ApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

interface HetznerErrorBody {
  error?: { code?: string; message?: string }
}

/** Unwraps an openapi-fetch result, throwing a readable ApiError on failure. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || result.data === undefined) {
    const body = result.error as HetznerErrorBody | undefined
    const message = body?.error?.message ?? `HTTP ${result.response.status}`
    throw new ApiError(message, result.response.status, body?.error?.code)
  }
  return result.data
}

// --- Type extraction helpers (the spec inlines schemas into operations) ---

type JsonContent<R> = R extends { content: { 'application/json': infer B } } ? B : never

/** 200-response JSON body of an operation. */
export type ResponseBody<Op> = Op extends { responses: { 200: infer R } } ? JsonContent<R> : never

/** 201-response JSON body (some creates respond 201). */
export type CreatedBody<Op> = Op extends { responses: { 201: infer R } } ? JsonContent<R> : ResponseBody<Op>

/** Element type of a list response key, e.g. ListItem<operations['list_ssh_keys'], 'ssh_keys'>. */
export type ListItem<Op, Key extends string> = ResponseBody<Op> extends Record<Key, (infer I)[]> ? I : never

/** Value type of a single-resource response key, e.g. ResponseItem<operations['get_ssh_key'], 'ssh_key'>. */
export type ResponseItem<Op, Key extends string> = ResponseBody<Op> extends Record<Key, infer V> ? V : never

/** JSON request body of an operation. */
export type RequestBody<Op> = Op extends { requestBody: infer RB }
  ? RB extends { content: { 'application/json': infer B } }
    ? B
    : never
  : never

/** Query params of an operation. */
export type QueryParams<Op> = Op extends { parameters: { query?: infer Q } } ? Q : Record<string, never>
