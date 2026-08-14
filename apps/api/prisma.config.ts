import "dotenv/config"
import { defineConfig, env } from "prisma/config"

// Prisma 7 要求将迁移/CLI 所需的连接串配置在 prisma.config.ts 中，而不是
// 放在 schema.prisma 的 datasource 块里。这里读取 Neon 池化连接串；运行时
// 的 PrismaClient 则单独通过 @prisma/adapter-neon 注入相同的连接串。
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
})