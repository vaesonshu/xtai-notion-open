import { Module } from "@nestjs/common"
import { ENVIRONMENT } from "../database/database.tokens"
import { AuthModule } from "../auth/auth.module"
import { DocumentsModule } from "../documents/documents.module"
import { loadEnvironment } from "../config/environment"
import { AiAgent } from "./ai.agent"
import { AiController } from "./ai.controller"
import { AiService } from "./ai.service"

@Module({
  imports: [AuthModule, DocumentsModule],
  controllers: [AiController],
  providers: [
    AiAgent,
    AiService,
    { provide: ENVIRONMENT, useFactory: () => loadEnvironment() },
  ],
})
export class AiModule {}
