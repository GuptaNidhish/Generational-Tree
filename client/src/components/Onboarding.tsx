import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../lib/motion'
import gsap from 'gsap'

type Props = {
  isOpen: boolean
  onClose: () => void
}

const STEPS = [
  {
    icon: (
      <svg className="size-10 text-bahi" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
        />
      </svg>
    ),
    title: 'Scroll & Pan to Explore',
    desc: 'Scroll down with your mouse or swipe on your phone to journey through 7 generations of family history, starting from Sh. Deviram Gupta.',
  },
  {
    icon: (
      <svg className="size-10 text-haldi-deep" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
        />
      </svg>
    ),
    title: 'Tap Any Family Member',
    desc: 'Click on any name card to view their direct lineage, parents, and children in a detailed side panel. The full bloodline lights up in gold!',
  },
  {
    icon: (
      <svg className="size-10 text-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    ),
    title: 'Search & Generation Filters',
    desc: 'Quickly find anyone by searching their name at the top, or filter the tree to inspect specific generations with the round chips.',
  },
]

export function Onboarding({ isOpen, onClose }: Props) {
  const [stepIndex, setStepIndex] = useState(0)
  const overlayRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const stepContentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      if (overlayRef.current && cardRef.current && !prefersReducedMotion()) {
        gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25 })
        gsap.fromTo(
          cardRef.current,
          { opacity: 0, scale: 0.9, y: 16 },
          { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: 'back.out(1.4)' }
        )
      }
    }
  }, [isOpen])

  // Animate step transitions
  useEffect(() => {
    if (stepContentRef.current && !prefersReducedMotion()) {
      gsap.fromTo(
        stepContentRef.current,
        { opacity: 0, x: 20 },
        { opacity: 1, x: 0, duration: 0.28, ease: 'power2.out' }
      )
    }
  }, [stepIndex])

  if (!isOpen) return null

  const isLast = stepIndex === STEPS.length - 1
  const currentStep = STEPS[stepIndex]

  function nextStep() {
    if (isLast) {
      handleComplete()
    } else {
      setStepIndex((i) => i + 1)
    }
  }

  function handleComplete() {
    if (cardRef.current && !prefersReducedMotion()) {
      gsap.to(cardRef.current, {
        opacity: 0,
        scale: 0.94,
        y: 10,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: () => {
          setStepIndex(0)
          onClose()
        },
      })
    } else {
      setStepIndex(0)
      onClose()
    }
  }

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-xs"
    >
      <div
        ref={cardRef}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-ink/15 bg-paper p-6 shadow-2xl sm:p-8"
      >
        {/* Skip button */}
        <button
          type="button"
          onClick={handleComplete}
          className="absolute top-4 right-4 cursor-pointer text-xs font-semibold text-ink-soft hover:text-ink focus:outline-none"
        >
          Skip
        </button>

        {/* Header label */}
        <div className="text-xs font-bold tracking-wider text-bahi uppercase">
          Welcome to Gupta Vanshavali
        </div>

        {/* Step Content */}
        <div ref={stepContentRef} className="mt-5 min-h-[170px]">
          <div className="mb-4 inline-flex size-16 items-center justify-center rounded-2xl bg-ink/5 shadow-inner">
            {currentStep.icon}
          </div>
          <h2 id="onboarding-title" className="font-display text-2xl font-bold text-ink">
            {currentStep.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{currentStep.desc}</p>
        </div>

        {/* Pagination Dots & Navigation */}
        <div className="mt-6 flex items-center justify-between border-t border-ink/10 pt-4">
          <div className="flex gap-1.5" aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}>
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === stepIndex ? 'w-6 bg-bahi' : 'w-2 bg-ink/20'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={() => setStepIndex((i) => i - 1)}
                className="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-soft hover:text-ink"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={nextStep}
              className="cursor-pointer rounded-lg bg-bahi px-5 py-2 text-sm font-bold text-kora shadow-md transition-all hover:bg-bahi-deep hover:shadow-lg focus-visible:ring-2 focus-visible:ring-haldi focus:outline-none"
            >
              {isLast ? 'Start Exploring' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
