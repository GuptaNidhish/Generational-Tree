import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, fetchTree, listComments } from './api'
import { AdminBar } from './components/AdminBar'
import { ErrorCard } from './components/ErrorBoundary'
import { AdminLogin } from './components/AdminLogin'
import { BackToTop } from './components/BackToTop'
import { ChangePassword } from './components/ChangePassword'
import { CommentsReview } from './components/CommentsReview'
import { GenerationNav } from './components/GenerationNav'
import { GenerationSection } from './components/GenerationSection'
import { Hero } from './components/Hero'
import { ManageAdmins } from './components/ManageAdmins'
import type { CardState } from './components/PersonCard'
import { ProfilePanel } from './components/ProfilePanel'
import { SiteHeader } from './components/SiteHeader'
import { StoryActionsContext, type StoryActions } from './components/storyActions'
import { useAdmin } from './hooks/useAdmin'
import { useScrollStory } from './hooks/useScrollStory'
import { revealNow } from './lib/animations'
import { indexFamily } from './lib/family'
import { buildGenerations, childWord, siblingsOf } from './lib/generations'
import { scrollBehavior } from './lib/motion'
import type { Person, TreeData, VisitorComment } from './types'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: TreeData }

// Bring an element to the middle of the screen, revealing its family first if it hasn't animated in yet
function scrollToElement(el: Element | null, block: ScrollLogicalPosition = 'center') {
  if (!el) return
  revealNow(el.closest('[data-family]'))
  el.querySelectorAll('[data-family]').forEach(revealNow)
  el.scrollIntoView({ behavior: scrollBehavior(), block })
}

type AdminDialog = 'login' | 'password' | 'admins' | 'comments' | null
const isAdminPath = () => window.location.pathname.replace(/\/+$/, '') === '/admin'

function FamilyStory({ data, reload }: { data: TreeData; reload: (force?: boolean) => Promise<void> }) {
  const family = useMemo(() => indexFamily(data), [data])
  const generations = useMemo(() => buildGenerations(data, family), [data, family])
  const generationNumbers = useMemo(() => generations.map((g) => g.number), [generations])
  const root = generations[0]?.members[0]

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [profileId, setProfileId] = useState<number | null>(null)
  const [pulse, setPulse] = useState(0)
  const [active, setActive] = useState<number | null>(null)
  const [pastHero, setPastHero] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  // the tree's data is the version: when an admin changes it, scroll triggers are rebuilt
  useScrollStory({ rootRef, progressRef, onActiveGeneration: setActive, onPastHero: setPastHero, dataVersion: data })

  // ── Admin ──
  const { admin, checked, setAdmin, signOut } = useAdmin()
  // /admin opens the sign-in dialog (shown once we know nobody is signed in)
  const [dialog, setDialog] = useState<AdminDialog>(() => (isAdminPath() ? 'login' : null))
  const [fetchedComments, setFetchedComments] = useState<VisitorComment[]>([])
  const newComments = useMemo(() => (admin ? fetchedComments : []), [admin, fetchedComments])
  // after adding someone, scroll to them once the refreshed tree has rendered
  const pendingFocus = useRef<number | null>(null)

  // already signed in: tidy the /admin address away
  useEffect(() => {
    if (admin && isAdminPath()) window.history.replaceState(null, '', '/')
  }, [admin])

  const refreshComments = useCallback(() => {
    if (admin) listComments('new').then(setFetchedComments, () => {})
  }, [admin])
  useEffect(refreshComments, [refreshComments])

  // Coming back to the tab: pick up changes other admins (or visitors) made
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState !== 'visible') return
      reload()
      refreshComments()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [reload, refreshComments])

  // The selected person's immediate family: parent, siblings and children
  const relatives = useMemo(() => {
    if (selectedId === null) return new Set<number>()
    return new Set(
      [...(family.parentsOf.get(selectedId) ?? []), ...siblingsOf(family, selectedId), ...(family.childrenOf.get(selectedId) ?? [])].map((p) => p.id)
    )
  }, [family, selectedId])

  const stateOf = useCallback(
    (id: number): CardState => (id === selectedId ? 'selected' : relatives.has(id) ? 'relative' : 'normal'),
    [selectedId, relatives]
  )

  const highlight = useCallback((id: number) => {
    setSelectedId(id)
    setPulse((n) => n + 1)
  }, [])

  const goToPerson = useCallback(
    (id: number) => {
      highlight(id)
      // let the highlight render before moving
      requestAnimationFrame(() => scrollToElement(document.querySelector(`[data-person-id="${id}"]`)))
    },
    [highlight]
  )

  const actions = useMemo<StoryActions>(
    () => ({
      open: (id) => {
        highlight(id)
        setProfileId(id)
      },
      goToPerson,
      goToChildren: (id) => {
        highlight(id)
        requestAnimationFrame(() => scrollToElement(document.querySelector(`[data-family="${id}"]`), 'start'))
      },
    }),
    [highlight, goToPerson]
  )

  const jumpToGeneration = useCallback((g: number) => {
    scrollToElement(document.getElementById(`generation-${g}`), 'start')
  }, [])

  const toTop = useCallback(() => window.scrollTo({ top: 0, behavior: scrollBehavior() }), [])
  const clearHighlight = useCallback(() => setSelectedId(null), [])
  const closeProfile = useCallback(() => setProfileId(null), [])

  const describe = useCallback(
    (p: Person) => {
      const parent = family.parentsOf.get(p.id)?.[0]
      const word = childWord(p.gender)
      return parent && word ? `${word} of ${parent.displayName}` : null
    },
    [family]
  )

  // Escape clears the highlight once the profile is closed
  useEffect(() => {
    if (selectedId === null || profileId !== null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, profileId])

  const selected = selectedId === null ? null : (family.byId.get(selectedId) ?? null)

  const closeDialog = useCallback(() => {
    setDialog(null)
    if (isAdminPath()) window.history.replaceState(null, '', '/')
  }, [])

  // An admin saved a change: refresh the tree for everyone on this page
  const onSaved = useCallback(
    async (person: Person, kind: 'edited' | 'child') => {
      if (kind === 'child') pendingFocus.current = person.id
      await reload(true)
    },
    [reload]
  )

  useEffect(() => {
    const id = pendingFocus.current
    if (id === null || !family.byId.has(id)) return
    pendingFocus.current = null
    goToPerson(id)
  }, [family, goToPerson])

  const commentsAboutProfile = useMemo(() => newComments.filter((c) => c.personId === profileId), [newComments, profileId])

  return (
    <StoryActionsContext.Provider value={actions}>
      <a href="#generation-1" className="sr-only z-50 rounded bg-wine px-3 py-2 text-paper focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to the family tree
      </a>

      <SiteHeader
        persons={data.persons}
        generations={generationNumbers}
        active={active}
        pastHero={pastHero}
        progressRef={progressRef}
        onJump={jumpToGeneration}
        onFind={(p) => goToPerson(p.id)}
        describe={describe}
        onHome={toTop}
      />

      <div ref={rootRef}>
        <Hero family={family} persons={data.persons} root={root} generationCount={generations.length} onBegin={() => jumpToGeneration(generationNumbers[0])} />

        <main>
          {generations.map((g, i) => (
            <GenerationSection
              key={g.number}
              generation={g}
              index={family}
              stateOf={stateOf}
              pulse={pulse}
              selectedId={selectedId}
              isFirst={i === 0}
            />
          ))}
        </main>

        <footer className="border-t border-gold/35 px-6 pt-14 pb-28 text-center lg:pb-14">
          <p className="font-display text-[1.5rem] text-wine">Gupta Vanshavali</p>
          <p className="mt-1 text-ink-soft">
            {data.persons.length} members across {generations.length} generations
            {root ? `, beginning with ${root.displayName}` : ''}.
          </p>
          <button type="button" onClick={toTop} className="mt-5 cursor-pointer text-[0.9375rem] font-medium text-gold-ink underline decoration-gold/60 underline-offset-4 hover:text-wine">
            Return to the top
          </button>
          {!admin && (
            <p className="mt-8 text-[0.875rem] text-ink-soft">
              Look after this tree?{' '}
              <button type="button" onClick={() => setDialog('login')} className="cursor-pointer font-medium text-gold-ink underline decoration-gold/60 underline-offset-4 hover:text-wine">
                Sign in as admin
              </button>
            </p>
          )}
        </footer>
      </div>

      {/* Phones and tablets: generation dock at the bottom */}
      <div
        className={`fixed inset-x-0 bottom-3 z-20 flex justify-center px-3 transition-[opacity,transform] duration-300 lg:hidden ${
          pastHero ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
        }`}
      >
        <GenerationNav
          generations={generationNumbers}
          active={active}
          onJump={jumpToGeneration}
          className="max-w-full overflow-x-auto rounded-full border border-gold/45 bg-ivory/95 px-2 py-1.5 shadow-[0_12px_28px_-14px_rgb(74_14_26_/_0.55)] backdrop-blur-sm scrollbar-none"
        />
      </div>

      {/* What is highlighted, and how to clear it */}
      {selected && profileId === null && (
        <div role="status" className="fixed inset-x-0 bottom-20 z-20 flex justify-center px-4 lg:bottom-6">
          <div className="flex max-w-full items-center gap-3 rounded-full border border-gold/50 bg-wine py-1.5 pr-1.5 pl-4 text-[0.9375rem] text-paper shadow-[0_12px_28px_-14px_rgb(74_14_26_/_0.7)]">
            <span className="truncate">
              Showing <span className="font-semibold">{selected.displayName}</span> and immediate family
            </span>
            <button type="button" onClick={clearHighlight} className="shrink-0 cursor-pointer rounded-full bg-paper/15 px-3 py-1 font-medium hover:bg-paper/25">
              Clear
            </button>
          </div>
        </div>
      )}

      <BackToTop visible={pastHero} onClick={toTop} />

      {admin && (
        <AdminBar
          admin={admin}
          newComments={newComments.length}
          onComments={() => setDialog('comments')}
          onManageAdmins={() => setDialog('admins')}
          onChangePassword={() => setDialog('password')}
          onSignOut={signOut}
        />
      )}
      {dialog === 'login' && checked && !admin && (
        <AdminLogin
          onClose={closeDialog}
          onSignedIn={(me) => {
            setAdmin(me)
            closeDialog()
          }}
        />
      )}
      {dialog === 'password' && admin && <ChangePassword onClose={closeDialog} />}
      {dialog === 'admins' && admin?.role === 'owner' && <ManageAdmins onClose={closeDialog} />}
      {dialog === 'comments' && admin && (
        <CommentsReview
          onClose={closeDialog}
          onChanged={refreshComments}
          onJump={(id) => {
            actions.open(id)
            goToPerson(id)
          }}
        />
      )}

      <ProfilePanel
        person={profileId === null ? null : (family.byId.get(profileId) ?? null)}
        family={family}
        persons={data.persons}
        describe={describe}
        admin={admin}
        comments={commentsAboutProfile}
        onSaved={onSaved}
        onCommentsChanged={refreshComments}
        onSelect={(id) => {
          actions.open(id)
          goToPerson(id)
        }}
        onShowInTree={(id) => {
          // the panel would cover part of the page, so step out of it
          closeProfile()
          goToPerson(id)
        }}
        onClose={closeProfile}
      />
    </StoryActionsContext.Provider>
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
      .catch((e: unknown) => {
        if (active) setState({ status: 'error', message: loadErrorMessage(e) })
      })
    return () => {
      active = false
    }
  }, [])

  const retry = () => {
    setState({ status: 'loading' })
    load()
  }

  useEffect(() => load(), [load])

  // Fetch the tree again without the loading screen (after an admin's change,
  // or when the tab regains focus). Keeps the same object when nothing changed,
  // so the page doesn't redo its layout for nothing.
  const lastJson = useRef('')
  const lastFetch = useRef(0)
  const reload = useCallback(async (force = false) => {
    // focus events come in pairs and often; an admin's save always goes through
    if (!force && Date.now() - lastFetch.current < 15_000) return
    lastFetch.current = Date.now()
    try {
      const data = await fetchTree()
      const json = JSON.stringify(data)
      if (json === lastJson.current) return
      lastJson.current = json
      setState({ status: 'ready', data })
    } catch {
      // keep showing what we have; the next focus will try again
    }
  }, [])
  useEffect(() => {
    if (state.status === 'ready' && !lastJson.current) {
      lastJson.current = JSON.stringify(state.data)
      lastFetch.current = Date.now()
    }
  }, [state])

  if (state.status === 'ready') return <FamilyStory data={state.data} reload={reload} />

  if (state.status === 'error') {
    return (
      <ErrorCard title="The family tree didn't load" action="Try again" onAction={retry}>
        <p className="mt-3 text-ink">{withFullStop(state.message)}</p>
        {import.meta.env.DEV && (
          <p className="mt-2 text-[0.9375rem] text-ink-soft">
            Check that the API server is running (<code className="rounded bg-gold/15 px-1">npm run dev</code> in the project root), then try again.
          </p>
        )}
      </ErrorCard>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4" role="status">
        <div className="size-9 animate-spin rounded-full border-2 border-gold border-t-transparent motion-reduce:animate-none" />
        <p className="font-display text-[1.75rem] text-wine">Opening the vanshavali</p>
      </div>
    </div>
  )
}

// Visitors see the server's own message, or a plain one for network failures;
// developers see the raw error
function loadErrorMessage(e: unknown): string {
  if (e instanceof ApiError && e.status > 0) return e.message
  if (import.meta.env.DEV && e instanceof Error) return e.message
  return "We couldn't reach the family tree. Check your connection and try again."
}

const withFullStop = (message: string) => (/[.!?]$/.test(message) ? message : `${message}.`)
