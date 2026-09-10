import "dotenv/config"
import { defineConfig } from "prisma/config"

// Prisma 7 要求将迁移/CLI 所需的连接串配置在 prisma.config.ts 中，而不是
// 放在 schema.prisma 的 datasource 块里。这里读取 Neon 池化连接串；运行时
// 的 PrismaClient 则单独通过 @prisma/adapter-neon 注入相同的连接串。
//
// 不用 env()：它在加载配置时就会抛错，导致 Vercel/CI 在未注入 DATABASE_URL
// 时连 prisma generate 都无法执行；generate 本身不需要真实连接。
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://build:build@127.0.0.1:5432/build?schema=public"

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: databaseUrl,
  },
})
