import { useEffect, useRef } from 'react'
import { loadTurnstile, TURNSTILE_SITE_KEY as SITE_KEY } from '../lib/turnstile'

type Props = {
  onToken: (token: string) => void // keep stable (e.g. a state setter)
  // bump to get a fresh challenge (tokens are single-use)
  resetKey: number
  // the script couldn't load (blocked or offline); keep stable too
  onUnavailable?: () => void
}

// Cloudflare's free "are you human" check. Renders nothing when no site key is configured.
export function Turnstile({ onToken, resetKey, onUnavailable }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!SITE_KEY || !ref.current) return
    let widget: string | null = null
    let cancelled = false
    loadTurnstile()
      .then((api) => {
        if (cancelled || !ref.current) return
        widget = api.render(ref.current, {
          sitekey: SITE_KEY,
          theme: 'light',
          callback: (token: string) => onToken(token),
          'expired-callback': () => onToken(''),
          'error-callback': () => onToken(''),
        })
      })
      .catch(() => {
        if (cancelled) return
        onToken('')
        onUnavailable?.()
      })
    return () => {
      cancelled = true
      if (widget) window.turnstile?.remove(widget)
    }
  }, [resetKey, onToken, onUnavailable])

  if (!SITE_KEY) return null
  return <div ref={ref} className="min-h-[65px]" />
}
