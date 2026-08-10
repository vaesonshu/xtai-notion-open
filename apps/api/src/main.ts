import "reflect-metadata"
import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { loadEnvironment } from "./config/environment"

async function bootstrap() {
  const env = loadEnvironment()
  const app = await NestFactory.create(AppModule)
  app.enableCors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  })
  await app.listen(env.PORT)
}

void bootstrap()
