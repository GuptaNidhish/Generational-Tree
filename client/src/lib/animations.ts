import gsap from 'gsap'
import { prefersReducedMotion } from './motion'

/** Duration helper — returns 0 when reduced motion preferred */
export const dur = (seconds: number) => (prefersReducedMotion() ? 0 : seconds)

/** Card stamp animation (root node) — seal pressed onto page */
export function stampCard(el: HTMLElement, delay = 0): gsap.core.Tween {
  if (prefersReducedMotion()) {
    return gsap.set(el, { opacity: 1, scale: 1, filter: 'none' }) as unknown as gsap.core.Tween
  }
  return gsap.fromTo(
    el,
    { scale: 1.35, opacity: 0, filter: 'blur(4px)' },
    {
      scale: 1,
      opacity: 1,
      filter: 'blur(0px)',
      duration: dur(0.85),
      delay,
      ease: 'elastic.out(1, 0.5)',
    }
  )
}

/** Card rise animation — slides up and fades in */
export function riseCard(el: HTMLElement, delay = 0): gsap.core.Tween {
  if (prefersReducedMotion()) {
    return gsap.set(el, { opacity: 1, y: 0, scale: 1 }) as unknown as gsap.core.Tween
  }
  return gsap.fromTo(
    el,
    { y: 22, opacity: 0, scale: 0.94 },
    {
      y: 0,
      opacity: 1,
      scale: 1,
      duration: dur(0.52),
      delay,
      ease: 'power3.out',
    }
  )
}

/** Subtle hover lift for cards */
export function hoverLift(el: HTMLElement): gsap.core.Tween {
  if (prefersReducedMotion()) return gsap.set(el, {}) as unknown as gsap.core.Tween
  return gsap.to(el, {
    y: -3,
    scale: 1.03,
    boxShadow: '0 8px 24px rgba(31, 35, 71, 0.16)',
    duration: dur(0.22),
    ease: 'power2.out',
  })
}

/** Reset hover lift */
export function hoverReset(el: HTMLElement): gsap.core.Tween {
  if (prefersReducedMotion()) return gsap.set(el, { y: 0, scale: 1, boxShadow: 'none' }) as unknown as gsap.core.Tween
  return gsap.to(el, {
    y: 0,
    scale: 1,
    boxShadow: 'none',
    duration: dur(0.18),
    ease: 'power2.inOut',
  })
}

/** Gentle bounce/pulse for selected card */
export function selectPulse(el: HTMLElement): gsap.core.Timeline {
  const tl = gsap.timeline()
  if (prefersReducedMotion()) return tl
  tl.to(el, { scale: 1.06, duration: dur(0.12), ease: 'power2.out' }).to(el, {
    scale: 1.0,
    duration: dur(0.28),
    ease: 'elastic.out(1.1, 0.4)',
  })
  return tl
}

/** Drawer slide in (desktop from right, mobile from bottom) */
export function slideInDrawer(el: HTMLElement, isMobile = false): gsap.core.Tween {
  if (prefersReducedMotion()) {
    return gsap.set(el, { x: 0, y: 0, opacity: 1 }) as unknown as gsap.core.Tween
  }
  if (isMobile) {
    return gsap.fromTo(
      el,
      { y: '100%', opacity: 0.6 },
      { y: '0%', opacity: 1, duration: dur(0.38), ease: 'power3.out' }
    )
  }
  return gsap.fromTo(
    el,
    { x: '100%', opacity: 0.6 },
    { x: '0%', opacity: 1, duration: dur(0.38), ease: 'power3.out' }
  )
}

/** Drawer slide out */
export function slideOutDrawer(
  el: HTMLElement,
  isMobile = false,
  onComplete?: () => void
): gsap.core.Tween {
  if (prefersReducedMotion()) {
    if (onComplete) onComplete()
    return gsap.set(el, { opacity: 0 }) as unknown as gsap.core.Tween
  }
  if (isMobile) {
    return gsap.to(el, {
      y: '100%',
      opacity: 0,
      duration: dur(0.28),
      ease: 'power2.in',
      onComplete,
    })
  }
  return gsap.to(el, {
    x: '100%',
    opacity: 0,
    duration: dur(0.28),
    ease: 'power2.in',
    onComplete,
  })
}

/** Stagger-reveal a list of child elements */
export function staggerIn(
  els: HTMLElement[] | NodeListOf<Element>,
  delay = 0
): gsap.core.Tween {
  if (prefersReducedMotion()) {
    return gsap.set(els, { y: 0, opacity: 1 }) as unknown as gsap.core.Tween
  }
  return gsap.fromTo(
    els,
    { y: 14, opacity: 0 },
    {
      y: 0,
      opacity: 1,
      duration: dur(0.32),
      delay,
      stagger: dur(0.05),
      ease: 'power2.out',
    }
  )
}

/** Animated number counter (e.g., "127 people") */
export function countUp(
  el: HTMLElement,
  target: number,
  duration = 1.1
): gsap.core.Tween {
  const obj = { val: 0 }
  if (prefersReducedMotion()) {
    el.textContent = target.toString()
    return gsap.set(el, {}) as unknown as gsap.core.Tween
  }
  return gsap.to(obj, {
    val: target,
    duration: dur(duration),
    ease: 'power2.out',
    onUpdate: () => {
      el.textContent = Math.round(obj.val).toString()
    },
  })
}

/** Tooltip / overlay fade in */
export function fadeIn(el: HTMLElement, duration = 0.3, delay = 0): gsap.core.Tween {
  if (prefersReducedMotion()) {
    return gsap.set(el, { opacity: 1, scale: 1 }) as unknown as gsap.core.Tween
  }
  return gsap.fromTo(
    el,
    { opacity: 0, scale: 0.96 },
    { opacity: 1, scale: 1, duration: dur(duration), delay, ease: 'power2.out' }
  )
}

/** Tooltip / overlay fade out */
export function fadeOut(
  el: HTMLElement,
  duration = 0.25,
  onComplete?: () => void
): gsap.core.Tween {
  if (prefersReducedMotion()) {
    if (onComplete) onComplete()
    return gsap.set(el, { opacity: 0 }) as unknown as gsap.core.Tween
  }
  return gsap.to(el, {
    opacity: 0,
    scale: 0.96,
    duration: dur(duration),
    ease: 'power2.in',
    onComplete,
  })
}
