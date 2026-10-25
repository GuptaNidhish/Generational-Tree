import type { TreeData } from './types'

export async function fetchTree(): Promise<TreeData> {
  const res = await fetch('/api/tree')
  if (!res.ok) throw new Error(`The server answered ${res.status} ${res.statusText}`.trim())
  return res.json()
}
