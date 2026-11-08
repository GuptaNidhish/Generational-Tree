type Props = { visible: boolean; onClick: () => void }

export function BackToTop({ visible, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back to top"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={`fixed right-4 bottom-20 z-20 grid size-12 cursor-pointer place-items-center rounded-full border border-gold/50 bg-paper text-wine shadow-[0_10px_24px_-12px_rgb(74_14_26_/_0.5)] transition-[opacity,transform,background-color] duration-300 hover:bg-wine hover:text-paper sm:right-6 lg:bottom-6 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <svg aria-hidden className="size-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd" />
      </svg>
    </button>
  )
}
