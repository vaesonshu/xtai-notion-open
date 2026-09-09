import { Module } from "@nestjs/common"
import { WorkspaceRepository } from "./workspace.repository"

@Module({
  providers: [WorkspaceRepository],
  exports: [WorkspaceRepository],
})
export class WorkspaceRepositoryModule {}
