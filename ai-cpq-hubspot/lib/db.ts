/**
 * Zero-dependency JSON file database.
 * Stores each table as a .json file in the .data/ directory.
 * Mimics the Supabase client API as a drop-in replacement.
 */

import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const DATA_DIR = path.join(process.cwd(), '.data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

function readTable(table: string): Record<string, unknown>[] {
  const file = path.join(DATA_DIR, `${table}.json`)
  if (!fs.existsSync(file)) return []
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return [] }
}

function writeTable(table: string, rows: Record<string, unknown>[]) {
  fs.writeFileSync(path.join(DATA_DIR, `${table}.json`), JSON.stringify(rows, null, 2))
}

function rowMatches(row: Record<string, unknown>, filters: Record<string, unknown>): boolean {
  return Object.entries(filters).every(([k, v]) => row[k] === v)
}

function ilike(str: string | null | undefined, pattern: string): boolean {
  return new RegExp('^' + pattern.replace(/%/g, '.*') + '$', 'i').test(str ?? '')
}

// Split "a, b(c, d), e" by top-level commas only
function splitTopLevel(s: string): string[] {
  const parts: string[] = []
  let depth = 0, cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

// Expand a row by resolving relation selects like "product:products(*)"
function expandRow(row: Record<string, unknown>, selectStr: string): Record<string, unknown> {
  const parts = splitTopLevel(selectStr)
  const out: Record<string, unknown> = { ...row } // always include base fields

  for (const part of parts) {
    if (part === '*') continue // already spread above
    // Match: alias:table(subselect) — e.g. product:products(*) or quote:quotes(*, items:quote_items(*,product:products(*)))
    const m = part.match(/^(\w+):(\w+)\((.+)\)$/)
    if (!m) continue

    const [, alias, relTable, subSelect] = m
    const fkCol = `${alias}_id`
    const relId = row[fkCol]

    if (!relId) { out[alias] = null; continue }

    const relRows = readTable(relTable)
    const found = relRows.find(r => r.id === relId)
    if (!found) { out[alias] = null; continue }

    // Recursively expand nested relations
    out[alias] = expandRow(found, subSelect)
  }

  // Special case: quote → attach items → each item attaches product
  if (selectStr.includes('items:quote_items')) {
    const items = readTable('quote_items')
      .filter(i => i.quote_id === out.id)
      .map(item => ({
        ...item,
        product: readTable('products').find(p => p.id === item.product_id) ?? null,
      }))
    out.items = items
  }

  return out
}

type DBError = Error & { code?: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DBResult = { data: any; error: null } | { data: null; error: DBError }

class QueryBuilder {
  private _table: string
  private _filters: Record<string, unknown> = {}
  private _orFilters: string[] = []
  private _select = '*'
  private _limit?: number
  private _orderBy?: { col: string; asc: boolean }
  private _inFilter?: { col: string; vals: unknown[] }
  private _single = false
  private _op: 'select' | 'insert' | 'update' | 'delete' = 'select'
  private _data?: unknown

  constructor(table: string) { this._table = table }

  select(cols = '*') { this._select = cols; this._op = 'select'; return this }
  insert(data: unknown) { this._op = 'insert'; this._data = data; return this }
  update(data: Record<string, unknown>) { this._op = 'update'; this._data = data; return this }
  delete() { this._op = 'delete'; return this }
  eq(col: string, val: unknown) { this._filters[col] = val; return this }
  in(col: string, vals: unknown[]) { this._inFilter = { col, vals }; return this }
  single() { this._single = true; return this }
  limit(n: number) { this._limit = n; return this }
  order(col: string, opts?: { ascending?: boolean }) {
    this._orderBy = { col, asc: opts?.ascending !== false }; return this
  }
  or(expr: string) { this._orFilters = expr.split(',').map(s => s.trim()); return this }

  // Make this a thenable so `await queryBuilder` works
  then<T>(
    onFulfilled: (val: DBResult) => T,
    onRejected?: (err: unknown) => T | PromiseLike<T>,
  ): Promise<T> {
    return new Promise<DBResult>((resolve) => {
      try {
        const rows = readTable(this._table)

        // INSERT
        if (this._op === 'insert') {
          const items = Array.isArray(this._data) ? this._data as Record<string, unknown>[] : [this._data as Record<string, unknown>]
          const now = new Date().toISOString()
          const inserted = items.map(item => ({ id: randomUUID(), created_at: now, updated_at: now, ...item }))
          writeTable(this._table, [...rows, ...inserted])
          resolve({ data: this._single ? inserted[0] : inserted, error: null })
          return
        }

        // UPDATE
        if (this._op === 'update') {
          const now = new Date().toISOString()
          let last: Record<string, unknown> | null = null
          const next = rows.map(r => {
            if (rowMatches(r, this._filters)) { last = { ...r, ...(this._data as object), updated_at: now }; return last }
            return r
          })
          writeTable(this._table, next)
          resolve({ data: this._single ? last : next.filter(r => rowMatches(r, this._filters)), error: null })
          return
        }

        // DELETE
        if (this._op === 'delete') {
          writeTable(this._table, rows.filter(r => !rowMatches(r, this._filters)))
          resolve({ data: null, error: null })
          return
        }

        // SELECT
        let result = rows.filter(row => {
          if (!rowMatches(row, this._filters)) return false
          if (this._inFilter && !this._inFilter.vals.includes(row[this._inFilter.col])) return false
          if (this._orFilters.length > 0) {
            return this._orFilters.some(expr => {
              const m = expr.match(/^(\w+)\.(ilike|eq)\.(.+)$/)
              if (!m) return false
              const [, col, op, val] = m
              if (op === 'ilike') return ilike(String(row[col] ?? ''), val)
              return row[col] === val
            })
          }
          return true
        })

        if (this._orderBy) {
          const { col, asc } = this._orderBy
          result.sort((a, b) => String(a[col] ?? '').localeCompare(String(b[col] ?? '')) * (asc ? 1 : -1))
        }
        if (this._limit) result = result.slice(0, this._limit)

        const final = result.map(row => expandRow(row, this._select))

        if (this._single) {
          resolve(final[0]
            ? { data: final[0], error: null }
            : { data: null, error: new Error('Row not found') })
        } else {
          resolve({ data: final, error: null })
        }
      } catch (err) {
        resolve({ data: null, error: err instanceof Error ? err : new Error(String(err)) })
      }
    }).then(onFulfilled, onRejected)
  }
}

export const db = { from: (table: string) => new QueryBuilder(table) }

// When SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set (cloud deployment),
// use the real Supabase client. Otherwise fall back to local JSON file database.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildClient(): any {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url && key) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('@supabase/supabase-js')
    return createClient(url, key)
  }
  return db
}

export const supabaseAdmin = buildClient()
