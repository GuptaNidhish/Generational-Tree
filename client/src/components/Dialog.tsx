import { useEffect, useId, useRef, type ReactNode } from 'react'

type Props = {
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}

// Centred modal on wide screens, bottom sheet on phones. Escape or the
// backdrop closes it; focus moves in on open and back out on close.
export function Dialog({ title, description, onClose, children, wide = false }: Props) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const first = ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])')
    ;(first ?? ref.current)?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      previous?.focus?.({ preventScroll: true })
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      <div aria-hidden onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative max-h-[90svh] w-full overflow-y-auto rounded-t-3xl border border-gold/50 bg-ivory px-6 pt-6 pb-8 shadow-[0_24px_60px_-24px_rgb(74_14_26_/_0.6)] sm:rounded-2xl sm:px-8 ${
          wide ? 'sm:max-w-3xl' : 'sm:max-w-md'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="font-display text-[1.75rem] leading-tight text-wine">
              {title}
            </h2>
            {description && <p className="mt-1 text-[0.9375rem] text-ink-soft">{description}</p>}
          </div>
          <button
            type="button"
            data-close
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-ink-soft hover:bg-gold/15 hover:text-ink"
          >
            <svg aria-hidden className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  )
}
