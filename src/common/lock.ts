import { sleep } from "./util"

class ConcurrencyLock {
    private id = 0
    private nextId = 0
    name: string
    waitTimeMs: number
    maxAttempts: number

    constructor(name: string, waitTimeMs: number, maxAttempts: number) {
        this.name = name
        this.waitTimeMs = waitTimeMs
        this.maxAttempts = maxAttempts
    }

    async lock() {
        const id = this.nextId++;
        for (let i = 0; i < this.maxAttempts; i++) {
            if (id === this.id)
                break
            await sleep(this.waitTimeMs)
        }
    
        if (id !== this.id)
            throw new Error(`ConcurrencyLock ${this.name} locked after ${Math.round(this.waitTimeMs * this.maxAttempts / 1000)} seconds of waiting`)
    }

    unlock() {
        this.id++
    }
}

const dbConcurrencyLock = new ConcurrencyLock('sqlite3Lock', 50, 200)

/** call dbUnlock() in function when done */
export async function dbLock() {
    await dbConcurrencyLock.lock()
}
export function dbUnlock() {
    dbConcurrencyLock.unlock()
}