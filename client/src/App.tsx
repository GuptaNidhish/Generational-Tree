import { useReactFlow } from '@xyflow/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchTree } from './api'
import { DetailsDrawer, DRAWER_WIDTH } from './components/DetailsDrawer'
import { FamilyTree } from './components/FamilyTree'
import { Onboarding } from './components/Onboarding'
import { TopBar } from './components/TopBar'
import { TreeActions } from './components/treeActions'
import { indexFamily, lineageOf } from './lib/family'
import { layoutTree, NODE_HEIGHT, NODE_WIDTH } from './lib/layout'
import { motionMs } from './lib/motion'
import type { TreeData } from './types'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: TreeData }

function TreeView({ data }: { data: TreeData }) {
  const { setCenter, getZoom, fitView } = useReactFlow()
  const family = useMemo(() => indexFamily(data), [data])
  const layout = useMemo(() => layoutTree(data), [data])
  const generations = useMemo(() => [...new Set(data.persons.map((p) => p.generationNumber))].sort((a, b) => a - b), [data])

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selectedGenerations, setSelectedGenerations] = useState<Set<number>>(new Set())
  const [explored, setExplored] = useState(false)
  const [showGuide, setShowGuide] = useState(() => {
    try {
      return !localStorage.getItem('vanshavali_visited')
    } catch {
      return false
    }
  })

  const lineage = useMemo(() => (selectedId === null ? null : lineageOf(family, selectedId)), [family, selectedId])

  const closeGuide = useCallback(() => {
    setShowGuide(false)
    try {
      localStorage.setItem('vanshavali_visited', 'true')
    } catch {
      // Ignore localStorage issues
    }
  }, [])

  // Select a person and bring their card to the middle of the screen
  const focusPerson = useCallback(
    (id: number) => {
      setSelectedId(id)
      const node = layout.nodes.find((n) => n.id === String(id))
      if (!node) return
      const zoom = Math.max(getZoom(), 0.95)
      const isMobile = window.innerWidth < 640

      // On wider screens the drawer covers the right edge; centre in the visible part
      const drawerOffsetX = !isMobile ? DRAWER_WIDTH / 2 / zoom : 0
      // On mobile, the bottom sheet covers the lower portion; position card slightly higher
      const drawerOffsetY = isMobile ? -(window.innerHeight * 0.16) / zoom : 0

      setCenter(node.position.x + NODE_WIDTH / 2 + drawerOffsetX, node.position.y + NODE_HEIGHT / 2 + drawerOffsetY, {
        zoom,
        duration: motionMs(500),
      })
    },
    [layout.nodes, setCenter, getZoom]
  )

  const changeGenerations = useCallback(
    (next: Set<number>) => {
      setSelectedGenerations(next)
      const ids = layout.nodes.filter((n) => next.size === 0 || next.has(n.data.person.generationNumber)).map((n) => ({ id: n.id }))
      // wait a frame so the dimmed state renders before the camera moves
      requestAnimationFrame(() => fitView({ nodes: ids, padding: 0.15, maxZoom: 1, duration: motionMs(500) }))
    },
    [layout.nodes, fitView]
  )

  const clearSelection = useCallback(() => setSelectedId(null), [])
  const markExplored = useCallback(() => setExplored(true), [])
  const actions = useMemo(() => ({ select: focusPerson }), [focusPerson])

  return (
    <TreeActions.Provider value={actions}>
      <div className="flex h-full flex-col">
        <TopBar
          persons={data.persons}
          generations={generations}
          selectedGenerations={selectedGenerations}
          onGenerationsChange={changeGenerations}
          onFind={(person) => focusPerson(person.id)}
          onShowGuide={() => setShowGuide(true)}
        />
        <main className="relative flex-1 overflow-clip">
          <FamilyTree
            layout={layout}
            lineage={lineage}
            selectedId={selectedId}
            selectedGenerations={selectedGenerations}
            onPaneClick={clearSelection}
            onExplore={markExplored}
          />

          {/* Navigation Hint */}
          <div
            aria-hidden={explored}
            className={`pointer-events-none absolute bottom-5 left-1/2 z-[6] -translate-x-1/2 transition-opacity duration-700 motion-reduce:transition-none ${
              explored || selectedId !== null ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            <div className="flex items-center gap-2 rounded-full border border-ink/10 bg-ink/85 px-4 py-2 text-xs font-medium text-kora shadow-lg backdrop-blur-md sm:text-sm">
              <span>Scroll to explore · Click any name for details</span>
            </div>
          </div>

          <DetailsDrawer
            person={selectedId === null ? null : (family.byId.get(selectedId) ?? null)}
            family={family}
            onSelect={focusPerson}
            onClose={clearSelection}
          />
        </main>

        {/* First visit / Help Onboarding Tour */}
        <Onboarding isOpen={showGuide} onClose={closeGuide} />
      </div>
    </TreeActions.Provider>
  )
}

export default function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  // returns a cancel function so a superseded request (e.g. StrictMode's remount) can't update the screen
  const load = useCallback(() => {
    let active = true
    fetchTree()
      .then((data) => {
        if (active) setState({ status: 'ready', data })
      })
      .catch((e: Error) => {
        if (active) setState({ status: 'error', message: e.message })
      })
    return () => {
      active = false
    }
  }, [])

  const retry = () => {
    setState({ status: 'loading' })
    load()
  }

  useEffect(() => {
    return load()
  }, [load])

  if (state.status === 'ready') return <TreeView data={state.data} />

  return (
    <div className="flex h-full items-center justify-center p-6">
      {state.status === 'loading' ? (
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-3 border-bahi border-t-transparent" />
          <p className="font-display text-2xl tracking-wide text-bahi">Opening the vanshavali…</p>
          <p className="text-xs text-ink-soft">Loading family lineage records</p>
        </div>
      ) : (
        <div role="alert" className="max-w-md rounded-xl border border-bahi/30 bg-paper p-6 shadow-xl">
          <div className="flex items-center gap-2">
            <span className="text-2xl text-bahi">⚠️</span>
            <h1 className="font-display text-2xl font-bold text-bahi">The family tree didn't load</h1>
          </div>
          <p className="mt-3 text-ink text-sm leading-relaxed">{state.message}.</p>
          <p className="mt-2 text-xs text-ink-soft leading-relaxed">
            Make sure the API server is running (<code className="rounded bg-ink/10 px-1 py-0.5 text-ink font-mono">npm run dev</code> in the project root), then try again.
          </p>
          <button
            type="button"
            onClick={retry}
            className="mt-5 w-full cursor-pointer rounded-lg bg-bahi py-2.5 font-bold text-kora shadow-md transition-colors hover:bg-bahi-deep"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
