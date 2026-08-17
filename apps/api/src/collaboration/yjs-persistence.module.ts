import { Module } from "@nestjs/common"
import { YjsPersistenceRepository } from "./yjs-persistence.repository"
import { YjsPersistenceService } from "./yjs-persistence.service"

// 独立模块供文档与协作层共享，避免 DocumentsModule ↔ CollaborationModule 循环依赖。
@Module({
  providers: [YjsPersistenceRepository, YjsPersistenceService],
  exports: [YjsPersistenceService],
})
export class YjsPersistenceModule {}
