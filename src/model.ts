export type Lang = 'ru' | 'kk';
export type Bi = { ru: string; kk: string };
export const bi = (ru: string, kk: string): Bi => ({ ru, kk });
export type Quiz = { kind: 'choice'; prompt: Bi; options: Bi[]; answer: number; why: Bi };
export type Order = { kind: 'order'; prompt: Bi; items: Bi[]; why: Bi };
export type Pairs = { kind: 'pairs'; prompt: Bi; pairs: [Bi, Bi][]; why: Bi };
export type Robot = { kind: 'robot'; prompt: Bi; size: number; start: number; target: number; walls: number[]; why: Bi };
export type Art = { kind: 'art'; prompt: Bi; shapes: string[]; why: Bi };
export type Activity = Quiz | Order | Pairs | Robot | Art;
export type Lesson = { id: string; grade: number; unit: Bi; title: Bi; icon: string; cards: { title: Bi; text: Bi }[]; activity: Activity; check: Quiz; source: string };
export type RecordEntry = { lessonId: string; completed: boolean; bestScore: number; updatedAt: string };
export type Progress = Record<string, RecordEntry>;
export function mergeProgress(...sets: Progress[]): Progress {
  const result: Progress = {};
  for (const set of sets) for (const [id, row] of Object.entries(set)) {
    const old = result[id];
    result[id] = old ? { lessonId: id, completed: old.completed || row.completed, bestScore: Math.max(old.bestScore, row.bestScore), updatedAt: old.updatedAt > row.updatedAt ? old.updatedAt : row.updatedAt } : { ...row };
  }
  return result;
}
export function moveRobot(position: number, direction: string, size: number, walls: number[]) {
  const x = position % size, y = Math.floor(position / size);
  const dx = direction === '→' ? 1 : direction === '←' ? -1 : 0;
  const dy = direction === '↓' ? 1 : direction === '↑' ? -1 : 0;
  const nx = x + dx, ny = y + dy, next = ny * size + nx;
  return nx < 0 || nx >= size || ny < 0 || ny >= size || walls.includes(next) ? position : next;
}
export function shuffled<T>(items: T[], seed: number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { seed = (seed * 1664525 + 1013904223) >>> 0; const j = seed % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
