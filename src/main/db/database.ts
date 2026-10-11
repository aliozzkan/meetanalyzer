import Database from 'better-sqlite3'
import { migrations } from './migrations'

export type Db = Database.Database

export function openDatabase(path: string): Db {
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

function migrate(db: Db): void {
  const current = db.pragma('user_version', { simple: true }) as number
  for (let version = current; version < migrations.length; version++) {
    db.transaction(() => {
      db.exec(migrations[version])
      db.pragma(`user_version = ${version + 1}`)
    })()
  }
}
