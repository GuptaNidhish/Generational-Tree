import type { AdminAccount, AdminUser, CommentInput, CommentStatus, Person, PersonInput, TreeData, VisitorComment } from './types'

export const ADMIN_SIGNED_OUT = 'vanshavali:admin-signed-out'

// An error carrying the server's own message, fit to show to the user
export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// Long enough for a free-tier server waking from sleep (up to about a minute)
const TIMEOUT_MS = 60_000

// status 0: no usable answer from the server at all
const NO_ANSWER = "We couldn't reach the server. Check your connection and try again."
const TOO_SLOW = 'The server took too long to answer. Please try again.'
const NOT_JSON = 'The server sent an unexpected answer. Please try again in a moment.'

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method: init.method ?? 'GET',
      credentials: 'same-origin',
      headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    throw new ApiError(e instanceof DOMException && e.name === 'TimeoutError' ? TOO_SLOW : NO_ANSWER, 0)
  }
  if (!res.ok) {
    let message = `The server answered ${res.status} ${res.statusText}`.trim()
    try {
      const body = await res.json()
      if (typeof body?.error === 'string') message = body.error
    } catch {
      // not JSON; keep the status line
    }
    // a removed admin, or an expired session: tell the app to show the signed-out view
    if (res.status === 401 && path.startsWith('/api/admin/') && path !== '/api/admin/login' && path !== '/api/admin/me') {
      window.dispatchEvent(new Event(ADMIN_SIGNED_OUT))
    }
    throw new ApiError(message, res.status)
  }
  try {
    return (await res.json()) as T
  } catch {
    // e.g. an HTML page from the host while the server is starting
    throw new ApiError(NOT_JSON, 0)
  }
}

export const fetchTree = () => request<TreeData>('/api/tree')

// Visitors
export const sendComment = (personId: number, input: CommentInput) =>
  request<{ ok: true; phone: string }>(`/api/persons/${personId}/comments`, { method: 'POST', body: input })

// Admin session
export const fetchMe = () => request<AdminUser | null>('/api/admin/me')
export const signIn = (username: string, password: string) =>
  request<AdminUser>('/api/admin/login', { method: 'POST', body: { username, password } })
export const signOut = () => request<{ ok: true }>('/api/admin/logout', { method: 'POST', body: {} })
export const changePassword = (currentPassword: string, newPassword: string) =>
  request<{ ok: true }>('/api/admin/me/password', { method: 'POST', body: { currentPassword, newPassword } })

// Owner: admin accounts
export const listAdmins = () => request<AdminAccount[]>('/api/admin/admins')
export const createAdmin = (username: string, password: string) =>
  request<AdminAccount>('/api/admin/admins', { method: 'POST', body: { username, password } })
export const removeAdmin = (id: number) => request<{ ok: true }>(`/api/admin/admins/${id}`, { method: 'DELETE' })

// Editing the tree
export const updatePerson = (id: number, input: PersonInput) =>
  request<Person>(`/api/admin/persons/${id}`, { method: 'PATCH', body: input })
export const addChild = (parentId: number, input: PersonInput) =>
  request<Person>(`/api/admin/persons/${parentId}/children`, { method: 'POST', body: input })

// Reviewing comments
export const listComments = (status: CommentStatus | 'all' = 'new') =>
  request<VisitorComment[]>(`/api/admin/comments?status=${status}`)
export const reviewComment = (id: number, status: CommentStatus, adminNote?: string) =>
  request<{ id: number; status: CommentStatus }>(`/api/admin/comments/${id}`, { method: 'PATCH', body: { status, adminNote } })
