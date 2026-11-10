import gsap from 'gsap'
import { prefersReducedMotion } from './motion'

// Counts a number up from zero (shows the final number straight away under reduced motion)
export function countUp(el: HTMLElement, target: number, duration = 1.2, delay = 0) {
  if (prefersReducedMotion()) {
    el.textContent = String(target)
    return
  }
  const counter = { value: 0 }
  el.textContent = '0'
  gsap.to(counter, {
    value: target,
    duration,
    delay,
    ease: 'power2.out',
    onUpdate: () => {
      el.textContent = String(Math.round(counter.value))
    },
  })
}

// Panel entrance: from the right on wide screens, from the bottom on phones
export function slideIn(el: HTMLElement, fromBottom: boolean) {
  if (prefersReducedMotion()) return
  gsap.fromTo(el, fromBottom ? { yPercent: 100 } : { xPercent: 100 }, { xPercent: 0, yPercent: 0, duration: 0.42, ease: 'power3.out' })
}

export function staggerIn(els: Element[] | NodeListOf<Element>, delay = 0) {
  if (prefersReducedMotion() || els.length === 0) return
  gsap.fromTo(els, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, delay, stagger: 0.05, ease: 'power2.out' })
}

// Reveal timelines of family clusters that have not been scrolled to yet,
// so a jump (search, navigation) can show its target immediately
const pendingReveals = new Map<Element, gsap.core.Timeline>()

export function registerReveal(el: Element, tl: gsap.core.Timeline) {
  pendingReveals.set(el, tl)
}

export function forgetReveals() {
  pendingReveals.clear()
}

export function revealNow(el: Element | null) {
  if (!el) return
  const tl = pendingReveals.get(el)
  if (!tl) return
  pendingReveals.delete(el)
  tl.progress(1)
}

export function markRevealed(el: Element) {
  pendingReveals.delete(el)
}
