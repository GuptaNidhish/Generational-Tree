import { expect, test } from 'vitest'
import { composeDisplayName, formatPhone, normalisePhone } from './forms'

test('normalisePhone matches the server rules', () => {
  expect(normalisePhone('98765 43210')).toBe('+919876543210')
  expect(normalisePhone('098765-43210')).toBe('+919876543210')
  expect(normalisePhone('+44 7700 900123')).toBe('+447700900123')
  expect(normalisePhone('5876543210')).toBeNull()
  expect(normalisePhone('+91 12345 67890')).toBeNull()
  expect(normalisePhone('')).toBeNull()
})

test('formatPhone groups Indian numbers', () => {
  expect(formatPhone('+919876543210')).toBe('+91 98765 43210')
  expect(formatPhone('+447700900123')).toBe('+447700900123')
})

test('composeDisplayName follows the family convention', () => {
  expect(composeDisplayName({ salutation: 'Sh', firstName: 'Bhagat', middleName: 'Ram', surname: 'Gupta' })).toBe('Sh. Bhagat Ram Gupta')
  expect(composeDisplayName({ salutation: 'Smt.', firstName: 'Kamla', middleName: '', surname: 'Gupta' })).toBe('Smt. Kamla Gupta')
  expect(composeDisplayName({ salutation: '', firstName: 'Asha', middleName: ' ', surname: 'Mehta' })).toBe('Asha Mehta')
})
