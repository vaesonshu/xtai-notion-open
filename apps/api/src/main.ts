import "reflect-metadata"
import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { loadEnvironment } from "./config/environment"

async function bootstrap() {
  const env = loadEnvironment()
  const app = await NestFactory.create(AppModule)
  // enable CORS and allow cookies from the web origin; credentials must be
  // allowed so browser can send HttpOnly session cookies.
  app.enableCors({
    origin: true,
    credentials: true,
  })
  await app.listen(env.PORT)
}

void bootstrap()
