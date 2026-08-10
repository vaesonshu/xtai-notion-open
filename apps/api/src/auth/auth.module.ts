import { Module } from "@nestjs/common"
import { DatabaseModule } from "../database/database.module"
import { DevelopmentIdentityGuard } from "./development-identity.guard"

@Module({
  imports: [DatabaseModule],
  providers: [DevelopmentIdentityGuard],
  exports: [DevelopmentIdentityGuard],
})
export class AuthModule {}
