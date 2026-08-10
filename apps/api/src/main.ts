import "reflect-metadata"
import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { loadEnvironment } from "./config/environment"

async function bootstrap() {
  const env = loadEnvironment()
  const app = await NestFactory.create(AppModule)
  await app.listen(env.PORT)
}

void bootstrap()
