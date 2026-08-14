import { Module } from "@nestjs/common"
import { DatabaseModule } from "../database/database.module"
import { DevelopmentIdentityGuard } from "./development-identity.guard"
import { UserRepository } from "./user.repository"
import { SessionRepository } from "./session.repository"
import { AuthService } from "./auth.service"
import { AuthController } from "./auth.controller"
import { SessionInitGuard } from "./session-init.guard"

@Module({
  imports: [DatabaseModule],
  providers: [
    DevelopmentIdentityGuard,
    UserRepository,
    SessionRepository,
    AuthService,
    SessionInitGuard,
  ],
  controllers: [AuthController],
  // DocumentsService reads roles here rather than trusting a client-provided header.
  exports: [
    DevelopmentIdentityGuard,
    SessionInitGuard,
    AuthService,
    UserRepository,
  ],
})
export class AuthModule {}
