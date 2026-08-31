import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common"
import { CurrentUser } from "../auth/current-user.decorator"
import type { DevUser } from "../auth/dev-user"
import { AuthenticatedIdentityGuard } from "../auth/authenticated-identity.guard"
import type { PublicationStatus } from "../documents/document-types"
import { AdminArticlesService } from "./admin-articles.service"
import { AdminUsersService } from "./admin-users.service"

function parsePublicationStatus(
  value?: string
): PublicationStatus | undefined {
  if (value === "draft" || value === "pending" || value === "published") {
    return value
  }
  return undefined
}

@Controller("admin")
@UseGuards(AuthenticatedIdentityGuard)
export class AdminController {
  constructor(
    @Inject(AdminArticlesService)
    private readonly articles: AdminArticlesService,
    @Inject(AdminUsersService) private readonly users: AdminUsersService
  ) {}

  @Get("dashboard/stats")
  getDashboardStats(@CurrentUser() user: DevUser) {
    return this.articles.getDashboardStats(user.id)
  }

  @Get("articles/categories")
  listCategories(@CurrentUser() user: DevUser) {
    return this.articles.listCategories(user.id)
  }

  @Get("articles")
  listArticles(
    @CurrentUser() user: DevUser,
    @Query("status") status?: string,
    @Query("category") category?: string,
    @Query("query") query?: string
  ) {
    return this.articles.listArticles(user.id, {
      status: parsePublicationStatus(status),
      category: category?.trim() || undefined,
      query: query?.trim() || undefined,
    })
  }

  @Get("users")
  listUsers(@CurrentUser() user: DevUser) {
    return this.users.listUsers(user.id)
  }

  @Post("users")
  createUser(
    @CurrentUser() user: DevUser,
    @Body()
    body: {
      email: string
      password: string
      displayName: string
      role?: "user" | "admin"
      color?: string
    }
  ) {
    return this.users.createUser(user.id, body)
  }

  @Patch("users/:userId")
  updateUser(
    @Param("userId") userId: string,
    @CurrentUser() user: DevUser,
    @Body()
    body: {
      email?: string
      password?: string
      displayName?: string
      role?: "user" | "admin"
      color?: string
    }
  ) {
    return this.users.updateUser(user.id, userId, body)
  }

  @Delete("users/:userId")
  deleteUser(@Param("userId") userId: string, @CurrentUser() user: DevUser) {
    return this.users.deleteUser(user.id, userId)
  }
}
