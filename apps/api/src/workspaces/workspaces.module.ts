import { Module } from "@nestjs/common"
import { AuthModule } from "../auth/auth.module"
import { DocumentsModule } from "../documents/documents.module"
import { WorkspaceRepositoryModule } from "./workspace-repository.module"
import { PublicWorkspacesController } from "./public-workspaces.controller"
import { WorkspacesController } from "./workspaces.controller"
import { WorkspacesService } from "./workspaces.service"

@Module({
  imports: [AuthModule, WorkspaceRepositoryModule, DocumentsModule],
  controllers: [WorkspacesController, PublicWorkspacesController],
  providers: [WorkspacesService],
  exports: [WorkspacesService, WorkspaceRepositoryModule],
})
export class WorkspacesModule {}
