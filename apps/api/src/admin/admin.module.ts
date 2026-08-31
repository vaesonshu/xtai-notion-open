import { Module } from "@nestjs/common"
import { AuthModule } from "../auth/auth.module"
import { DocumentsRepositoryModule } from "../documents/documents-repository.module"
import { AdminAccess } from "./admin.helpers"
import { AdminArticlesService } from "./admin-articles.service"
import { AdminController } from "./admin.controller"
import { AdminUsersService } from "./admin-users.service"

@Module({
  imports: [AuthModule, DocumentsRepositoryModule],
  controllers: [AdminController],
  providers: [AdminAccess, AdminArticlesService, AdminUsersService],
})
export class AdminModule {}
