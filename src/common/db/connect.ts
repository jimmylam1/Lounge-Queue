import sqlite3 from 'sqlite3'
import { RunResult, sqlite3Wrapper } from '../../types/db'
import { dbLock, dbUnlock } from '../lock'

/**
 * This function will wait until the db is unlocked before executing a query.
 * It will automatically close the db connection when done. Whatever is
 * returned from the callback function will also be returned by calling dbConnect().
 * 
 * @returns Returns the return value from calling callbackFn
 */
export async function dbConnect<T>(callbackFn: (db: sqlite3Wrapper) => Promise<T>) {
    await dbLock()

    // main code
    const sql3 = new sqlite3.Database('loungeQueue.db')
    const database: sqlite3Wrapper = {
        execute: (sql: string, params: any[] = []) => {
            return new Promise<RunResult>((resolve, reject) => {
                sql3.run(sql, params, function(e) {
                    e ? reject(e) : resolve({lastID: this.lastID, changes: this.changes})
                })
            })
        },
        fetchOne: <T>(sql: string, params: any[] = []): Promise<T> => {
            return new Promise((resolve, reject) => {
                sql3.get(sql, params, (err, row: T) => {
                    err ? reject(err) : resolve(row)
                })
            })
        },
        fetchAll: <T>(sql: string, params: any[] = []): Promise<T[]> => {
            return new Promise((resolve, reject) => {
                sql3.all(sql, params, (err, rows: T[]) => {
                    err ? reject(err) : resolve(rows)
                })
            })
        }
    }

    sql3.get("PRAGMA foreign_keys = ON")
    const res = await callbackFn(database).finally(() => {
        sql3.close()
        dbUnlock()
    })
    return res
}
