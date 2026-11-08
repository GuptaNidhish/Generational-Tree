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

// ── Admin & comments ─────────────────────────

export type AdminRole = 'owner' | 'admin'
export type AdminUser = { username: string; role: AdminRole }
export type AdminAccount = { id: number; username: string; role: AdminRole; createdAt: string }

// Fields an admin can set on a person (generation follows from the parent)
export type PersonInput = {
  salutation: string
  firstName: string
  middleName: string
  surname: string
  displayName: string
  gender: 'Male' | 'Female' | ''
}

export type CommenterLink = 'self' | 'ancestor' | 'none'
export type CommentStatus = 'new' | 'resolved' | 'dismissed'

export type CommentInput = {
  name: string
  phone: string
  link: CommenterLink
  linkedPersonId: number | null
  relation: string
  message: string
  turnstileToken: string
}

type PersonSummary = Pick<Person, 'id' | 'displayName' | 'generationNumber'>

export type VisitorComment = {
  id: number
  personId: number
  name: string
  phone: string
  link: CommenterLink
  linkedPersonId: number | null
  relation: string | null
  message: string
  status: CommentStatus
  adminNote: string | null
  resolvedAt: string | null
  createdAt: string
  person: PersonSummary
  linkedPerson: PersonSummary | null
  resolvedBy: { username: string } | null
}
