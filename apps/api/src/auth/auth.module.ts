import { Module } from "@nestjs/common"
import { ConfigModule } from "../config/config.module"
import { DocumentsRepositoryModule } from "../documents/documents-repository.module"
import { WorkspaceRepositoryModule } from "../workspaces/workspace-repository.module"
import { DevelopmentIdentityGuard } from "./development-identity.guard"
import { UserRepository } from "./user.repository"
import { SessionRepository } from "./session.repository"
import { AuthService } from "./auth.service"
import { AuthController } from "./auth.controller"
import { SessionInitGuard } from "./session-init.guard"
import { UserOnboardingService } from "./user-onboarding.service"
import { UserCloudAiService } from "./user-cloud-ai.service"
import { UsersController } from "./users.controller"

@Module({
  imports: [ConfigModule, WorkspaceRepositoryModule, DocumentsRepositoryModule],
  providers: [
    DevelopmentIdentityGuard,
    UserRepository,
    SessionRepository,
    AuthService,
    SessionInitGuard,
    UserOnboardingService,
    UserCloudAiService,
  ],
  controllers: [AuthController, UsersController],
  // DocumentsService reads roles here rather than trusting a client-provided header.
  exports: [
    DevelopmentIdentityGuard,
    SessionInitGuard,
    AuthService,
    UserRepository,
    UserCloudAiService,
  ],
})
export class AuthModule {}
