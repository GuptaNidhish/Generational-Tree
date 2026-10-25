// Shapes returned by the Express API (see server/app.js)

export type Person = {
  id: number
  salutation: string | null
  firstName: string
  middleName: string | null
  surname: string
  displayName: string
  gender: string
  generationNumber: number
}

export type Relationship = {
  parentId: number
  childId: number
}

export type TreeData = {
  persons: Person[]
  relationships: Relationship[]
}
