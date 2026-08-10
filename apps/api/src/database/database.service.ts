import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common"
import {
  type Pool,
  type QueryResult,
  type QueryResultRow,
} from "pg"
import { DATABASE_POOL } from "./database.tokens"

export interface DatabaseClient {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<QueryResult<T>>
}

@Injectable()
export class DatabaseService implements OnModuleDestroy, DatabaseClient {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values)
  }

  async withTransaction<T>(
    fn: (client: DatabaseClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query("BEGIN")
      const result = await fn({
        query: <R extends QueryResultRow = QueryResultRow>(
          text: string,
          values?: unknown[]
        ) => client.query<R>(text, values),
      })
      await client.query("COMMIT")
      return result
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end()
  }
}
