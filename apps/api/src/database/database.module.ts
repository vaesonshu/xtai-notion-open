import { Global, Module } from "@nestjs/common"
import { Pool } from "pg"
import {
  type Environment,
  loadEnvironment,
} from "../config/environment"
import { DatabaseService } from "./database.service"
import { DATABASE_POOL, ENVIRONMENT } from "./database.tokens"

@Global()
@Module({
  providers: [
    {
      provide: ENVIRONMENT,
      useFactory: (): Environment => loadEnvironment(),
    },
    {
      provide: DATABASE_POOL,
      inject: [ENVIRONMENT],
      useFactory: (env: Environment): Pool =>
        new Pool({ connectionString: env.DATABASE_URL }),
    },
    DatabaseService,
  ],
  exports: [DatabaseService, ENVIRONMENT, DATABASE_POOL],
})
export class DatabaseModule {}
