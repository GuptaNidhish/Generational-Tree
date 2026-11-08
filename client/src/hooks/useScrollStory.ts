import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useLayoutEffect, type RefObject } from 'react'
import { forgetReveals, markRevealed, registerReveal } from '../lib/animations'

gsap.registerPlugin(ScrollTrigger)

type Options = {
  rootRef: RefObject<HTMLElement | null>
  progressRef: RefObject<HTMLElement | null>
  onActiveGeneration: (generation: number | null) => void
  onPastHero: (past: boolean) => void
}

// All scroll-driven behaviour for the page:
//  - always: which generation is on screen, whether the hero has gone, reading progress
//  - only when motion is welcome: hero parallax, section descenders and numerals,
//    the slight "camera tilt" as each generation arrives, and per-family reveals
export function useScrollStory({ rootRef, progressRef, onActiveGeneration, onPastHero }: Options) {
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const mm = gsap.matchMedia(root)
    const ctx = gsap.context(() => {
      const sections = gsap.utils.toArray<HTMLElement>('[data-generation]', root)

      // Navigation state (independent of motion preferences)
      for (const section of sections) {
        const generation = Number(section.dataset.generation)
        ScrollTrigger.create({
          trigger: section,
          start: 'top 55%',
          end: 'bottom 55%',
          onToggle: (self) => {
            if (self.isActive) onActiveGeneration(generation)
          },
        })
      }
      if (sections[0]) {
        ScrollTrigger.create({
          trigger: sections[0],
          start: 'top 55%',
          onLeaveBack: () => onActiveGeneration(null),
        })
      }
      const hero = root.querySelector('[data-hero]')
      if (hero) {
        ScrollTrigger.create({
          trigger: hero,
          start: 'bottom 30%',
          onEnter: () => onPastHero(true),
          onLeaveBack: () => onPastHero(false),
        })
      }
      if (progressRef.current) {
        gsap.fromTo(
          progressRef.current,
          { scaleX: 0 },
          { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: true } }
        )
      }

      mm.add(
        {
          motion: '(prefers-reduced-motion: no-preference)',
          depth: '(prefers-reduced-motion: no-preference) and (pointer: fine) and (min-width: 768px)',
        },
        (mmCtx) => {
          const { motion, depth } = mmCtx.conditions as { motion: boolean; depth: boolean }
          if (!motion) return

          // Hero: text drifts up and the tree settles back as you leave
          if (hero) {
            const leave = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
            gsap.to('[data-hero-text]', { yPercent: -40, opacity: 0.15, ease: 'none', scrollTrigger: leave })
            gsap.to('[data-hero-tree]', { y: 80, scale: depth ? 0.92 : 1, opacity: 0.35, ease: 'none', scrollTrigger: leave })
            gsap.to('[data-hero-foot]', { y: -30, opacity: 0, ease: 'none', scrollTrigger: { ...leave, end: '60% top' } })
            gsap.from('[data-hero-text] > *', { y: 24, opacity: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out', delay: 0.1 })
          }

          for (const section of sections) {
            const q = gsap.utils.selector(section)
            // The thread to the previous generation draws as you approach
            gsap.fromTo(q('[data-descender]'), { scaleY: 0 }, {
              scaleY: 1,
              ease: 'none',
              scrollTrigger: { trigger: section, start: 'top 95%', end: 'top 45%', scrub: true },
            })
            // The big numeral moves slower than the page
            gsap.fromTo(q('[data-numeral]'), { yPercent: -25 }, {
              yPercent: 35,
              ease: 'none',
              scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true },
            })
            // The heading swings up out of the page as the generation arrives.
            // (Only leaf elements get 3D transforms: transforming a container
            // would throw off ScrollTrigger's measurements of everything inside.)
            gsap.from(q('[data-heading]'), {
              y: 40,
              opacity: 0,
              ...(depth ? { rotationX: -50, transformPerspective: 800, transformOrigin: '50% 100%' } : {}),
              duration: 1,
              ease: 'power3.out',
              scrollTrigger: { trigger: section, start: 'clamp(top 70%)', once: true },
            })
          }

          // Each family: the branches grow down, then the cards rise in turn
          for (const cluster of gsap.utils.toArray<HTMLElement>('[data-family]', root)) {
            const q = gsap.utils.selector(cluster)
            const tl = gsap.timeline({ paused: true, onComplete: () => markRevealed(cluster) })
            const label = q('[data-family-label]')
            const lines = q('[data-connectors]')
            if (label.length) tl.fromTo(label, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, 0)
            if (lines.length) tl.fromTo(lines, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.8, ease: 'power2.inOut' }, 0.1)
            tl.fromTo(
              q('[data-card]'),
              depth
                ? { opacity: 0, y: 44, rotationX: 22, z: -90, transformPerspective: 900, transformOrigin: '50% 0%' }
                : { opacity: 0, y: 28 },
              { opacity: 1, y: 0, rotationX: 0, z: 0, duration: 0.75, stagger: 0.08, ease: 'power3.out', clearProps: 'transform' },
              lines.length ? 0.35 : 0.05
            )
            registerReveal(cluster, tl)
            const st = ScrollTrigger.create({ trigger: cluster, start: 'clamp(top 88%)', once: true, onEnter: () => tl.play() })
            // Already scrolled past (e.g. after a resize): show it straight away
            if (st.progress > 0 || window.scrollY > st.start) tl.progress(1)
          }

          return () => forgetReveals()
        }
      )
    }, root)

    // Web fonts change heights; recalculate trigger positions once they are in
    document.fonts?.ready.then(() => ScrollTrigger.refresh())

    return () => {
      mm.revert()
      ctx.revert()
    }
  }, [rootRef, progressRef, onActiveGeneration, onPastHero])
}
