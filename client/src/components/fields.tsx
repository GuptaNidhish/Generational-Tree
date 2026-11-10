import type { ReactNode } from 'react'

// Shared form pieces in the site's style

export const inputClass =
  'w-full rounded-lg border border-gold/45 bg-paper px-3 py-2 text-[1rem] text-ink placeholder:text-ink-soft/80 transition-[border-color,box-shadow] focus:border-gold focus:shadow-[0_0_0_3px_rgb(216_190_135_/_0.45)] focus:outline-none aria-[invalid=true]:border-wine'

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[0.9375rem] font-medium text-ink">{label}</span>
      {hint && <span className="block text-[0.875rem] text-ink-soft">{hint}</span>}
      <span className="mt-1 block">{children}</span>
      {error && <span className="mt-1 block text-[0.875rem] text-wine">{error}</span>}
    </label>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-lg border border-wine/30 bg-wine/5 px-3 py-2 text-[0.9375rem] text-wine">
      {message}
    </p>
  )
}

export function PrimaryButton({ busy, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button
      {...rest}
      disabled={busy || rest.disabled}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-wine px-5 py-2.5 font-medium text-paper transition-colors hover:bg-wine-deep disabled:cursor-not-allowed disabled:opacity-60 ${rest.className ?? ''}`}
    >
      {busy && <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-paper border-t-transparent motion-reduce:animate-none" />}
      {children}
    </button>
  )
}

export function QuietButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-gold/50 px-4 py-2 text-[0.9375rem] font-medium text-gold-ink transition-colors hover:border-gold hover:bg-gold/10 hover:text-wine disabled:cursor-not-allowed disabled:opacity-60 ${props.className ?? ''}`}
    />
  )
}
