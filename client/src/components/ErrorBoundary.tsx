import { Component, type ErrorInfo, type ReactNode } from 'react'

// The card shown when the tree can't be displayed (load failure or a crash)
export function ErrorCard({ title, children, action, onAction }: { title: string; children: ReactNode; action: string; onAction: () => void }) {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div role="alert" className="max-w-md rounded-2xl border border-gold/50 bg-paper p-7 shadow-[0_18px_40px_-20px_rgb(74_14_26_/_0.5)]">
        <h1 className="font-display text-[1.75rem] leading-tight text-wine">{title}</h1>
        {children}
        <button type="button" onClick={onAction} className="mt-6 w-full cursor-pointer rounded-full bg-wine py-2.5 font-medium text-paper hover:bg-wine-deep">
          {action}
        </button>
      </div>
    </div>
  )
}

// Catches render errors anywhere below, so one bad record can't leave a blank page
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('The page crashed while rendering:', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <ErrorCard title="Something went wrong" action="Reload the page" onAction={() => window.location.reload()}>
        <p className="mt-3 text-ink">The family tree hit a problem while drawing this page. Reloading usually fixes it.</p>
      </ErrorCard>
    )
  }
}
