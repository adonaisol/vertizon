export const SELF_CONTRADICTION = /contradicts itself|self-contradict/i;

export function flagsSelfContradiction(notes: string[]): boolean {
  return notes.some((n) => SELF_CONTRADICTION.test(n));
}
