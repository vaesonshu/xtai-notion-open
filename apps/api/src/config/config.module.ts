import { Global, Module } from "@nestjs/common"
import type { Environment } from "./environment"
import { loadEnvironment } from "./environment"
import { ENVIRONMENT } from "./tokens"

// 全局提供应用配置对象，替代原来由 DatabaseModule 提供的 ENVIRONMENT token。
// 这样删除 DatabaseModule 后所有消费方仍可通过注入得到环境变量。
@Global()
@Module({
  providers: [
    {
      provide: ENVIRONMENT,
      useFactory: (): Environment => loadEnvironment(),
    },
  ],
  exports: [ENVIRONMENT],
})
export class ConfigModule {}
