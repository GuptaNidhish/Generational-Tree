# Gupta Vanshavali — client

Vite + React 19 + TypeScript + Tailwind CSS v4, animated with GSAP and ScrollTrigger. The page loads the whole family once from `GET /api/tree` and lays it out in the browser. No family data lives in the client.

```bash
npm run dev     # http://localhost:5173, proxies /api to :4000
npm test        # vitest: data grouping, tree geometry, search
npm run build   # type-check and build to dist/
npm run lint
```

## How the page is put together

| Piece | Where |
| --- | --- |
| Data loading, selection and highlight state | `src/App.tsx` |
| Generations split into sibling groups, ordered depth-first | `src/lib/generations.ts` |
| Hero tree geometry (one branch per link, one leaf per person) | `src/lib/treeShape.ts`, `components/TreeSilhouette.tsx` |
| One section per generation → family clusters → person cards | `components/GenerationSection.tsx`, `FamilyCluster.tsx`, `PersonCard.tsx`, `Patriarch.tsx` |
| Parent → child branches, measured from the real layout | `components/BranchConnectors.tsx` |
| Scroll behaviour: active generation, progress, reveals, parallax | `src/hooks/useScrollStory.ts` |
| Profile panel (parent, siblings, children, line of descent) | `components/ProfilePanel.tsx` |

Motion notes:

- Every scroll animation is registered in `gsap.matchMedia()` under `prefers-reduced-motion: no-preference`. With reduced motion nothing is hidden or animated.
- Card tilt and the 3D entrance are limited to fine pointers on screens at least 768px wide (`canTilt` in `src/lib/motion.ts`).
- Only leaf elements (cards, headings, numerals) get transforms. Transforming a container would throw off ScrollTrigger's measurements of the families inside it.
