import { Module } from "@nestjs/common"
import { loadEnvironment } from "../config/environment"
import { CosService } from "./cos.service"

@Module({
  providers: [
    {
      provide: CosService,
      useFactory: () => new CosService(loadEnvironment()),
    },
  ],
  exports: [CosService],
})
export class CosModule {}
