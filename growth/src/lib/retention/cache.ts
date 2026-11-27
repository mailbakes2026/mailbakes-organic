type Entry<T> = { at: number; value: T; generation: number };

let memory: Entry<unknown> | null = null;
let generation = 0;

export function retentionGeneration() {
  return generation;
}

export function readRetentionMemory<T>(ttlMs: number, now = Date.now()): T | null {
  if (!memory || memory.generation !== generation) return null;
  if (now - memory.at >= ttlMs) return null;
  return memory.value as T;
}

export function writeRetentionMemory<T>(value: T, now = Date.now(), seen = generation) {
  if (seen !== generation) return;
  memory = { at: now, value, generation: seen };
}

export function invalidateRetentionCache() {
  generation += 1;
  memory = null;
}
