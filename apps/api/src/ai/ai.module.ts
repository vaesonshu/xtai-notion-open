import { Module } from "@nestjs/common"
import { ENVIRONMENT } from "../config/tokens"
import { AuthModule } from "../auth/auth.module"
import { DocumentsModule } from "../documents/documents.module"
import { WorkspacesModule } from "../workspaces/workspaces.module"
import { loadEnvironment } from "../config/environment"
import { AiAgent } from "./ai.agent"
import { ArticleAgent } from "./article.agent"
import { AiWriteAgent } from "./ai-write.agent"
import { AiController } from "./ai.controller"
import { AiService } from "./ai.service"

@Module({
  imports: [AuthModule, DocumentsModule, WorkspacesModule],
  controllers: [AiController],
  providers: [
    AiAgent,
    ArticleAgent,
    {
      provide: AiWriteAgent,
      useFactory: (environment: ReturnType<typeof loadEnvironment>) =>
        new AiWriteAgent(environment),
      inject: [ENVIRONMENT],
    },
    AiService,
    { provide: ENVIRONMENT, useFactory: () => loadEnvironment() },
  ],
})
export class AiModule {}
