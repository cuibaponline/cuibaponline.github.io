/** Uniform-grid broad phase. Rebuilt every tick; buckets are reused to avoid garbage. */
export class SpatialGrid<T> {
  private readonly buckets = new Map<number, T[]>();
  private readonly active: T[][] = [];
  private readonly seen = new Set<T>();

  constructor(private readonly cellSize: number) {}

  private key(cx: number, cy: number): number {
    return (cx + 2048) * 8192 + (cy + 2048);
  }

  clear(): void {
    for (const bucket of this.active) bucket.length = 0;
    this.active.length = 0;
  }

  insert(item: T, x: number, y: number, radius: number): void {
    const s = this.cellSize;
    const x0 = Math.floor((x - radius) / s);
    const x1 = Math.floor((x + radius) / s);
    const y0 = Math.floor((y - radius) / s);
    const y1 = Math.floor((y + radius) / s);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const k = this.key(cx, cy);
        let bucket = this.buckets.get(k);
        if (!bucket) {
          bucket = [];
          this.buckets.set(k, bucket);
        }
        if (bucket.length === 0) this.active.push(bucket);
        bucket.push(item);
      }
    }
  }

  /** Calls `visit` once per item near the circle. Return true from `visit` to stop early. */
  query(x: number, y: number, radius: number, visit: (item: T) => boolean | void): void {
    const s = this.cellSize;
    const x0 = Math.floor((x - radius) / s);
    const x1 = Math.floor((x + radius) / s);
    const y0 = Math.floor((y - radius) / s);
    const y1 = Math.floor((y + radius) / s);
    this.seen.clear();
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const bucket = this.buckets.get(this.key(cx, cy));
        if (!bucket) continue;
        for (const item of bucket) {
          if (this.seen.has(item)) continue;
          this.seen.add(item);
          if (visit(item) === true) return;
        }
      }
    }
  }
}
