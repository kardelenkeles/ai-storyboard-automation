import fs from 'node:fs/promises'
import path from 'node:path'

import sqlite3 from 'sqlite3'

type SqliteRunResult = sqlite3.RunResult

function openDatabase(filePath: string): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(filePath, (error: Error | null) => {
      if (error !== null) {
        reject(error)
        return
      }

      resolve(database)
    })
  })
}

export class SqliteConnection {
  private constructor(private readonly database: sqlite3.Database) {}

  static async open(filePath: string): Promise<SqliteConnection> {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    return new SqliteConnection(await openDatabase(filePath))
  }

  async exec(sql: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.database.exec(sql, (error: Error | null) => {
        if (error !== null) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }

  async run(sql: string, params: readonly unknown[] = []): Promise<SqliteRunResult> {
    return await new Promise<SqliteRunResult>((resolve, reject) => {
      this.database.run(sql, [...params], function onRun(this: sqlite3.RunResult, error: Error | null) {
        if (error !== null) {
          reject(error)
          return
        }

        resolve(this)
      })
    })
  }

  async all<T>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
    return await new Promise<T[]>((resolve, reject) => {
      this.database.all(sql, [...params], (error: Error | null, rows: T[]) => {
        if (error !== null) {
          reject(error)
          return
        }

        resolve(rows)
      })
    })
  }

  async get<T>(sql: string, params: readonly unknown[] = []): Promise<T | undefined> {
    return await new Promise<T | undefined>((resolve, reject) => {
      this.database.get(sql, [...params], (error: Error | null, row: T | undefined) => {
        if (error !== null) {
          reject(error)
          return
        }

        resolve(row)
      })
    })
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.database.close((error: Error | null) => {
        if (error !== null) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
}