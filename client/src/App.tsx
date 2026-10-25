import { useReactFlow } from '@xyflow/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchTree } from './api'
import { DetailsDrawer, DRAWER_WIDTH } from './components/DetailsDrawer'
import { FamilyTree } from './components/FamilyTree'
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
  const lineage = useMemo(() => (selectedId === null ? null : lineageOf(family, selectedId)), [family, selectedId])

  // Select a person and bring their card to the middle of the screen
  const focusPerson = useCallback(
    (id: number) => {
      setSelectedId(id)
      const node = layout.nodes.find((n) => n.id === String(id))
      if (!node) return
      const zoom = Math.max(getZoom(), 0.9)
      // On wider screens the drawer covers the right edge; centre in the visible part
      const drawerOffset = window.innerWidth >= 640 ? DRAWER_WIDTH / 2 / zoom : 0
      setCenter(node.position.x + NODE_WIDTH / 2 + drawerOffset, node.position.y + NODE_HEIGHT / 2, {
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
          <p
            aria-hidden={explored}
            className={`pointer-events-none absolute bottom-4 left-1/2 z-[6] hidden -translate-x-1/2 rounded-full bg-ink/85 px-4 py-1.5 text-sm text-kora transition-opacity duration-700 motion-reduce:transition-none sm:block ${
              explored || selectedId !== null ? 'opacity-0' : 'opacity-100'
            }`}
          >
            Scroll to explore. Pinch or Ctrl + scroll to zoom.
          </p>
          <DetailsDrawer
            person={selectedId === null ? null : (family.byId.get(selectedId) ?? null)}
            family={family}
            onSelect={focusPerson}
            onClose={clearSelection}
          />
        </main>
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
      .then((data) => active && setState({ status: 'ready', data }))
      .catch((e: Error) => active && setState({ status: 'error', message: e.message }))
    return () => {
      active = false
    }
  }, [])

  const retry = () => {
    setState({ status: 'loading' })
    load()
  }

  useEffect(load, [load])

  if (state.status === 'ready') return <TreeView data={state.data} />

  return (
    <div className="flex h-full items-center justify-center p-6">
      {state.status === 'loading' ? (
        <p className="font-display text-2xl text-bahi">Opening the vanshavali…</p>
      ) : (
        <div role="alert" className="max-w-md border-l-4 border-bahi bg-paper p-6">
          <h1 className="font-display text-2xl text-bahi">The family tree didn't load</h1>
          <p className="mt-2 text-ink">{state.message}.</p>
          <p className="mt-1 text-ink-soft">
            Make sure the API server is running (<code className="text-ink">npm run dev</code> in the project root), then try again.
          </p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 cursor-pointer rounded-md bg-bahi px-4 py-2 font-semibold text-kora hover:bg-bahi-deep"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
