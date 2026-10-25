import type { Person, TreeData } from '../types'

// Small tree for tests: Deviram → Johari, Malagar; Johari → Bhagat Ram
function person(id: number, firstName: string, middleName: string | null, generationNumber: number): Person {
  const displayName = ['Sh.', firstName, middleName, 'Gupta'].filter(Boolean).join(' ')
  return { id, salutation: 'Sh', firstName, middleName, surname: 'Gupta', displayName, gender: 'Male', generationNumber }
}

export const fixture: TreeData = {
  persons: [
    person(1, 'Deviram', null, 1),
    person(2, 'Johari', null, 2),
    person(3, 'Malagar', null, 2),
    person(4, 'Bhagat', 'Ram', 3),
  ],
  relationships: [
    { parentId: 1, childId: 2 },
    { parentId: 1, childId: 3 },
    { parentId: 2, childId: 4 },
  ],
}
