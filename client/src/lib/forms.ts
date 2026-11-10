// Client-side mirrors of the server's checks (server/validate.js), so people
// see problems as they type. The server still has the final say.

export function normalisePhone(input: string): string | null {
  const digits = input.trim().replace(/[\s\-().]/g, '')
  if (/^\+\d{8,15}$/.test(digits)) {
    if (digits.startsWith('+91') && !/^\+91[6-9]\d{9}$/.test(digits)) return null
    return digits
  }
  const local = digits.replace(/^(0091|91|0)(?=\d{10}$)/, '')
  if (/^[6-9]\d{9}$/.test(local)) return `+91${local}`
  return null
}

// "+919876543210" → "+91 98765 43210"
export function formatPhone(phone: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(phone)
  return m ? `+91 ${m[1]} ${m[2]}` : phone
}

// The family's convention: "Sh. Bhagat Ram Gupta" (salutation with a full stop)
export function composeDisplayName(parts: { salutation: string; firstName: string; middleName: string; surname: string }): string {
  const salutation = parts.salutation.trim()
  const title = salutation && !salutation.endsWith('.') ? `${salutation}.` : salutation
  return [title, parts.firstName.trim(), parts.middleName.trim(), parts.surname.trim()].filter(Boolean).join(' ')
}
