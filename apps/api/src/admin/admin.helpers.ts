import { ForbiddenException, Inject, Injectable } from "@nestjs/common"
import { UserRepository } from "../auth/user.repository"

/** 复用管理员校验，避免各 Admin 服务重复查 role。 */
@Injectable()
export class AdminAccess {
  constructor(@Inject(UserRepository) private readonly users: UserRepository) {}

  async assertAdmin(userId: string): Promise<void> {
    const user = await this.users.findById(userId)
    if (user?.role !== "admin") {
      throw new ForbiddenException("Administrator role required")
    }
  }
}
