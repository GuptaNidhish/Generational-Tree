// Sequential generation scale: bahi-ledger red for the eldest, through ochre and
// green, to indigo for the youngest. Used for card rules and generation chips.
const GENERATION_COLORS = [
  '#9B1C22', // 1
  '#B4432B', // 2
  '#B86A2E', // 3
  '#A68A2C', // 4
  '#5E8549', // 5
  '#2E7673', // 6
  '#34508F', // 7
]

export function generationColor(generation: number): string {
  const i = Math.min(Math.max(generation, 1), GENERATION_COLORS.length) - 1
  return GENERATION_COLORS[i]
}
