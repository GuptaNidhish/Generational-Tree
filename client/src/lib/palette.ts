// One muted tone per generation, from the wine of the eldest through rust,
// ochre and olive to slate, then plum for generations added later. Used for the thin rule on each
// card and the generation marks, so a card's generation reads at a glance.
const GENERATION_COLORS = [
  '#6B1626', // I
  '#8A3324', // II
  '#97582A', // III
  '#82702F', // IV
  '#5C6B3E', // V
  '#3F6360', // VI
  '#3E4F6E', // VII
  '#5B4670', // VIII
  '#6E4A5E', // IX
  '#55606A', // X
]

export function generationColor(generation: number): string {
  const i = Math.min(Math.max(generation, 1), GENERATION_COLORS.length) - 1
  return GENERATION_COLORS[i]
}
