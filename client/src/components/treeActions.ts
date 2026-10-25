import { createContext, useContext } from 'react'

// Lets tree nodes (rendered by React Flow) select a person without prop drilling
export const TreeActions = createContext<{ select: (id: number) => void }>({ select: () => {} })

export const useTreeActions = () => useContext(TreeActions)
