import { Inject, Injectable } from "@nestjs/common"
import type { Prisma } from "../generated/prisma/client"
import { PrismaService } from "../database/prisma.module"

export type YjsSnapshotRow = {
  snapshot: Buffer
  sequence: string | number | bigint
}

export type YjsUpdateRow = {
  update: Buffer
  sequence: string | number | bigint
}

function toNumber(value: string | number | bigint): number {
  if (typeof value === "number") {
    return value
  }
  return Number(value)
}

@Injectable()
export class YjsPersistenceRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getLatestSnapshot(
    documentId: string
  ): Promise<{ snapshot: Buffer; sequence: number } | null> {
    const row = await this.prisma.client.yjsSnapshot.findFirst({
      where: { documentId },
      orderBy: { sequence: "desc" },
    })
    if (!row) {
      return null
    }
    return {
      snapshot: Buffer.from(row.snapshot),
      sequence: toNumber(row.sequence),
    }
  }

  async listUpdatesAfter(
    documentId: string,
    afterSequence: number
  ): Promise<Array<{ update: Buffer; sequence: number }>> {
    const rows = await this.prisma.client.yjsUpdate.findMany({
      where: { documentId, sequence: { gt: afterSequence } },
      orderBy: { sequence: "asc" },
    })
    return rows.map((row) => ({
      update: Buffer.from(row.update),
      sequence: toNumber(row.sequence),
    }))
  }

  async getMaxSequence(documentId: string): Promise<number> {
    const [snapshotMax, updateMax] = await Promise.all([
      this.prisma.client.yjsSnapshot.aggregate({
        where: { documentId },
        _max: { sequence: true },
      }),
      this.prisma.client.yjsUpdate.aggregate({
        where: { documentId },
        _max: { sequence: true },
      }),
    ])
    return Math.max(
      toNumber(snapshotMax._max.sequence ?? 0),
      toNumber(updateMax._max.sequence ?? 0)
    )
  }

  async countUpdatesAfterSequence(
    documentId: string,
    sequence: number
  ): Promise<number> {
    return this.prisma.client.yjsUpdate.count({
      where: { documentId, sequence: { gt: sequence } },
    })
  }

  async insertUpdates(
    documentId: string,
    updates: Uint8Array[]
  ): Promise<{ lastSequence: number }> {
    if (updates.length === 0) {
      const max = await this.getMaxSequence(documentId)
      return { lastSequence: max }
    }

    return this.prisma.client.$transaction(
      async (tx) => {
        // 对同一文档加事务级 advisory 锁，串行化 sequence 的“读 MAX + 1”与
        // 插入，避免并发 flush 读到相同起始 sequence 而触发唯一约束冲突。
        // hashtext 碰撞只会导致不同文档偶发串行化（仅轻微影响性能），不会漏锁。
        // pg_advisory_xact_lock 返回 void，$queryRaw 无法反序列化；用 $executeRaw 仅执行锁
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${documentId}))`
        const start = await this.nextSequenceIn(tx, documentId)
        await tx.yjsUpdate.createMany({
          data: updates.map((update, index) => ({
            documentId,
            sequence: BigInt(start + index),
            update: Buffer.from(update),
          })),
        })
        return { lastSequence: start + updates.length - 1 }
      },
      {
        // advisory lock 竞争或 Neon 冷启动时，默认 2s maxWait 容易触发 P2028
        maxWait: 10_000,
        timeout: 30_000,
      }
    )
  }

  async insertSnapshot(
    documentId: string,
    snapshot: Uint8Array,
    sequence: number
  ): Promise<void> {
    await this.prisma.client.yjsSnapshot.create({
      data: {
        documentId,
        snapshot: Buffer.from(snapshot),
        sequence: BigInt(sequence),
      },
    })
  }

  async deleteUpdatesUpTo(documentId: string, sequence: number): Promise<void> {
    await this.prisma.client.yjsUpdate.deleteMany({
      where: { documentId, sequence: { lte: sequence } },
    })
  }

  /** 列出文档全部 Yjs 快照，供版本历史展示 */
  async listSnapshots(documentId: string): Promise<
    Array<{
      id: bigint
      sequence: number
      createdAt: Date
      snapshot: Buffer
    }>
  > {
    const rows = await this.prisma.client.yjsSnapshot.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" },
    })
    return rows.map((row) => ({
      id: row.id,
      sequence: toNumber(row.sequence),
      createdAt: row.createdAt,
      snapshot: Buffer.from(row.snapshot),
    }))
  }

  async getSnapshotById(
    snapshotId: bigint
  ): Promise<{
    id: bigint
    documentId: string
    sequence: number
    createdAt: Date
    snapshot: Buffer
  } | null> {
    const row = await this.prisma.client.yjsSnapshot.findUnique({
      where: { id: snapshotId },
    })
    if (!row) return null
    return {
      id: row.id,
      documentId: row.documentId,
      sequence: toNumber(row.sequence),
      createdAt: row.createdAt,
      snapshot: Buffer.from(row.snapshot),
    }
  }

  /** 清空增量更新，使协作文档仅由新快照驱动 */
  async deleteAllUpdates(documentId: string): Promise<void> {
    await this.prisma.client.yjsUpdate.deleteMany({
      where: { documentId },
    })
  }

  private async nextSequenceIn(
    tx: Prisma.TransactionClient,
    documentId: string
  ): Promise<number> {
    const [snapshotMax, updateMax] = await Promise.all([
      tx.yjsSnapshot.aggregate({
        where: { documentId },
        _max: { sequence: true },
      }),
      tx.yjsUpdate.aggregate({
        where: { documentId },
        _max: { sequence: true },
      }),
    ])
    return (
      Math.max(
        toNumber(snapshotMax._max.sequence ?? 0),
        toNumber(updateMax._max.sequence ?? 0)
      ) + 1
    )
  }
}
