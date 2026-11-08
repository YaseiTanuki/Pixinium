import { Client, types, type QueryResultRow } from 'pg'
import { runtimeDatabaseConnection } from './database-connection'
import { databaseTlsConfig } from './database-tls'

// Preserve the HTTP driver's string representation of SQL dates/timestamps.
for (const oid of [1082, 1114, 1184]) types.setTypeParser(oid, value => value)

interface DatabaseClient {
  connect(): Promise<unknown>
  query(text: string, values?: unknown[]): Promise<{ rows: QueryResultRow[] }>
  end(): Promise<unknown>
}

class Statement<T extends QueryResultRow = QueryResultRow> implements Promise<T[]> {
  readonly [Symbol.toStringTag] = 'Promise'
  private result?: Promise<T[]>
  private consumed = false
  constructor(readonly owner: symbol, readonly text: string, readonly values: unknown[],
    private execute: (statement: Statement<T>) => Promise<T[]>) {}
  get started() { return Boolean(this.result) || this.consumed }
  consume() { this.consumed = true }
  then<TResult1 = T[], TResult2 = never>(fulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    rejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2> {
    if (this.consumed) return Promise.reject(new Error('Statement was consumed by a transaction.')).then(fulfilled, rejected)
    this.result ??= this.execute(this)
    return this.result.then(fulfilled, rejected)
  }
  catch<TResult = never>(rejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null): Promise<T[] | TResult> {
    return this.then(undefined, rejected)
  }
  finally(onfinally?: (() => void) | null): Promise<T[]> { return this.then().finally(onfinally) }
}

export interface Database {
  <T extends QueryResultRow = QueryResultRow>(parts: TemplateStringsArray, ...values: unknown[]): Statement<T>
  query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Statement<T>
  transaction(statements: Statement[] | ((sql: Database) => Statement[]), options?: {
    readOnly?: boolean; isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable'
  }): Promise<QueryResultRow[][]>
}

/** Lazy statements keep transaction-local identity settings and writes on one connection. */
export function createDatabase(connectionString: string, createClient: () => DatabaseClient = () =>
  new Client({ ...databaseTlsConfig(runtimeDatabaseConnection(connectionString)), connectionTimeoutMillis: 10_000, application_name: 'pixinium' })): Database {
  if (!connectionString) throw new Error('A PostgreSQL connection string is required.')
  const owner = Symbol('database')
  async function withClient<T>(operation: (client: DatabaseClient) => Promise<T>) {
    const client = createClient()
    try {
      await client.connect()
      return await operation(client)
    } finally { await client.end().catch(() => {}) }
  }
  const sql = (<T extends QueryResultRow>(parts: TemplateStringsArray, ...values: unknown[]) =>
    sql.query<T>(parts.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, ''), values)) as Database
  sql.query = <T extends QueryResultRow>(text: string, values: unknown[] = []) =>
    new Statement<T>(owner, text, [...values], statement => withClient(async client =>
      (await client.query(statement.text, statement.values)).rows as T[]))
  sql.transaction = async (input, options = {}) => {
    const statements = typeof input === 'function' ? input(sql) : input
    if (statements.some(statement => !(statement instanceof Statement) || statement.owner !== owner || statement.started)) {
      throw new Error('Transactions require unexecuted statements from the same database.')
    }
    for (const statement of statements) statement.consume()
    const isolation = { ReadUncommitted: 'READ UNCOMMITTED', ReadCommitted: 'READ COMMITTED',
      RepeatableRead: 'REPEATABLE READ', Serializable: 'SERIALIZABLE' } as const
    const level = options.isolationLevel ? isolation[options.isolationLevel] : undefined
    return withClient(async client => {
      await client.query(`BEGIN${level ? ` ISOLATION LEVEL ${level}` : ''}${options.readOnly ? ' READ ONLY' : ''}`)
      try {
        const results = []
        for (const statement of statements) results.push((await client.query(statement.text, statement.values)).rows)
        await client.query('COMMIT')
        return results
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {})
        throw error
      }
    })
  }
  return sql
}
