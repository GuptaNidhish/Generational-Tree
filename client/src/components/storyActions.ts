import { createContext, useContext } from 'react'

export type StoryActions = {
  // Open someone's profile (and highlight them where they stand)
  open: (id: number) => void
  // Highlight someone and bring their card to the middle of the screen
  goToPerson: (id: number) => void
  // Highlight someone and scroll to their children in the next generation
  goToChildren: (id: number) => void
}

export const StoryActionsContext = createContext<StoryActions>({
  open: () => {},
  goToPerson: () => {},
  goToChildren: () => {},
})

export const useStoryActions = () => useContext(StoryActionsContext)
