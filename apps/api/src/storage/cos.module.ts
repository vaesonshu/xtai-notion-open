import { Module } from "@nestjs/common"
import { CosService } from "./cos.service"

@Module({
  providers: [
    {
      provide: CosService,
      useFactory: () => new CosService(process.env),
    },
  ],
  exports: [CosService],
})
export class CosModule {}
