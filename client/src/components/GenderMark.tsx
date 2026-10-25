// ♂ / ♀ with a readable label for screen readers
export function GenderMark({ gender, className = '' }: { gender: string; className?: string }) {
  const female = gender.toLowerCase() === 'female'
  const male = gender.toLowerCase() === 'male'
  if (!female && !male) return null
  return (
    <span className={className} role="img" aria-label={gender}>
      {female ? '♀' : '♂'}
    </span>
  )
}
