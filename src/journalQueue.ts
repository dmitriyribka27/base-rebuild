import type { JournalEntry } from './journal'

// Write the latest snapshot for each day in order. Fast typing cannot leave an
// older IndexedDB write as the last saved value, and intermediate snapshots
// are coalesced while a transaction is in progress.
export class JournalWriteQueue {
  private pending = new Map<string, JournalEntry>()
  private flushing: Promise<void> | null = null

  constructor(private readonly write: (entry: JournalEntry) => Promise<void>, private readonly onError: (error: unknown) => void) {}

  enqueue(entry: JournalEntry) {
    this.pending.set(entry.date, entry)
    this.start()
  }

  private start() {
    if (this.flushing || !this.pending.size) return
    const work = (async () => {
      while (this.pending.size) {
        const [date, entry] = this.pending.entries().next().value as [string, JournalEntry]
        this.pending.delete(date)
        try { await this.write(entry) }
        catch (error) { this.onError(error) }
      }
    })()
    this.flushing = work
    void work.finally(() => { this.flushing = null; this.start() })
  }

  async whenIdle() {
    while (this.flushing) await this.flushing
  }
}
