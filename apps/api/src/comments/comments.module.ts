import { Module } from "@nestjs/common"
import { AuthModule } from "../auth/auth.module"
import { SquareArticleCommentsController } from "./comments.controller"
import { CommentsRepository } from "./comments.repository"
import { CommentsService } from "./comments.service"

@Module({
  imports: [AuthModule],
  controllers: [SquareArticleCommentsController],
  providers: [CommentsRepository, CommentsService],
})
export class CommentsModule {}
