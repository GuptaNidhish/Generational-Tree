import { useCallback, useEffect, useState } from 'react'
import { ADMIN_SIGNED_OUT, fetchMe, signOut as apiSignOut } from '../api'
import type { AdminUser } from '../types'

// Who is signed in (null for visitors). Checks the session cookie on load and
// drops back to the visitor view if the server stops accepting it.
export function useAdmin() {
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let active = true
    fetchMe()
      .then((me) => active && setAdmin(me))
      .catch(() => {})
      .finally(() => active && setChecked(true))
    const lost = () => setAdmin(null)
    window.addEventListener(ADMIN_SIGNED_OUT, lost)
    return () => {
      active = false
      window.removeEventListener(ADMIN_SIGNED_OUT, lost)
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      await apiSignOut()
    } finally {
      setAdmin(null)
    }
  }, [])

  return { admin, checked, setAdmin, signOut }
}
