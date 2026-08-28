import { Module } from "@nestjs/common"
import { DocumentsRepository } from "./documents.repository"

/** 仅导出 DocumentsRepository，供 YjsPersistence 等模块使用，避免与 DocumentsModule 循环依赖。 */
@Module({
  providers: [DocumentsRepository],
  exports: [DocumentsRepository],
})
export class DocumentsRepositoryModule {}
