import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, fetchTree } from './api'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => vi.unstubAllGlobals())

describe('request', () => {
  it('returns the parsed body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ persons: [], relationships: [] })))
    await expect(fetchTree()).resolves.toEqual({ persons: [], relationships: [] })
  })

  it("passes on the server's own error message and status", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'Too many requests. Please wait a minute and try again.' }, 429)))
    const error = await fetchTree().catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(429)
    expect(error.message).toBe('Too many requests. Please wait a minute and try again.')
  })

  it('gives every request a timeout', async () => {
    const fetchMock = vi.fn(async () => json({}))
    vi.stubGlobal('fetch', fetchMock)
    await fetchTree()
    const init = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init[1].signal).toBeInstanceOf(AbortSignal)
  })

  it('turns a timeout into a plain message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new DOMException('signal timed out', 'TimeoutError'))))
    const error = await fetchTree().catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(0)
    expect(error.message).toMatch(/took too long/)
  })

  it('turns a network failure into a plain message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    const error = await fetchTree().catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(0)
    expect(error.message).toMatch(/couldn't reach the server/)
  })

  it('turns an HTML page where JSON was expected into a plain message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html><p>Service waking up</p>', { status: 200, headers: { 'Content-Type': 'text/html' } })))
    const error = await fetchTree().catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(0)
    expect(error.message).not.toMatch(/JSON|Unexpected token/)
  })
})
