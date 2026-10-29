import { BadRequestException, ForbiddenException } from "@nestjs/common"
import { afterEach, describe, expect, it, vi } from "vitest"
import * as editorCore from "@xtai-notion/editor-core/server"
import { blocksToMarkdown } from "@xtai-notion/editor-core/server"
import type { DocumentsRepository } from "@api/documents/documents.repository"
import { DocumentsService } from "@api/documents/documents.service"
import type { WorkspaceRepository } from "@api/workspaces/workspace.repository"

const defaultWorkspace = {
  id: "ws-1",
  name: "我的知识库",
  slug: null as string | null,
  visibility: "private" as const,
  settings: {},
  createdBy: "user-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}

function createRepo(
  overrides: Partial<DocumentsRepository> = {}
): DocumentsRepository {
  return {
    getMemberRole: vi.fn(),
    findById: vi.fn().mockResolvedValue({
      id: "doc-1",
      workspace_id: "ws-1",
      title: "Demo",
      depth: 1,
      publication_status: "draft",
      created_at: new Date("2026-01-01T00:00:00.000Z"),
      updated_at: new Date("2026-01-02T00:00:00.000Z"),
    }),
    countMembers: vi.fn().mockResolvedValue(1),
    ...overrides,
  } as unknown as DocumentsRepository
}

function createWorkspaces(
  overrides: Partial<WorkspaceRepository> = {}
): WorkspaceRepository {
  return {
    getMemberRole: vi.fn().mockResolvedValue("owner"),
    findById: vi.fn().mockResolvedValue(defaultWorkspace),
    findBySlug: vi.fn().mockResolvedValue(null),
    findDefaultForUser: vi.fn().mockResolvedValue(defaultWorkspace),
    create: vi.fn().mockResolvedValue(defaultWorkspace),
    ...overrides,
  } as unknown as WorkspaceRepository
}

/** 与 documents.service.spec.ts 相同的构造方式；缺的依赖用空对象假实现。 */
function makeService(
  repo: DocumentsRepository,
  workspaces = createWorkspaces(),
  users: unknown = {},
  persistence: unknown = {},
  shareLinks: unknown = {}
) {
  return new DocumentsService(
    repo,
    workspaces,
    users as never,
    persistence as never,
    shareLinks as never
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("DocumentsService.exportMarkdown", () => {
  it("does not load yjs when the reader is unauthorized", async () => {
    const repo = createRepo({
      getMemberRole: vi.fn().mockResolvedValue(null),
    })
    const persistence = { loadDocument: vi.fn() }
    const service = makeService(
      repo,
      createWorkspaces({ getMemberRole: vi.fn().mockResolvedValue(null) }),
      {},
      persistence
    )

    await expect(
      service.exportMarkdown("doc-1", "stranger")
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(persistence.loadDocument).not.toHaveBeenCalled()
  })

  it("returns markdown when the reader can access non-empty blocks", async () => {
    const blocks = [
      {
        id: "block-1",
        type: "paragraph",
        props: {},
        content: [{ type: "text", text: "Hello", styles: {} }],
        children: [],
      },
    ]
    vi.spyOn(editorCore, "documentFromYjsOrStarter").mockReturnValue(
      blocks as never
    )
    const persistence = {
      loadDocument: vi.fn().mockResolvedValue({ destroy: vi.fn() }),
    }
    const service = makeService(
      createRepo(),
      createWorkspaces(),
      {},
      persistence
    )

    await expect(service.exportMarkdown("doc-1", "user-1")).resolves.toBe(
      blocksToMarkdown(blocks as never)
    )
    expect(persistence.loadDocument).toHaveBeenCalledWith("doc-1")
  })

  it("rejects whitespace-only markdown after trim", async () => {
    vi.spyOn(editorCore, "documentFromYjsOrStarter").mockReturnValue([
      {
        id: "block-empty",
        type: "paragraph",
        props: {},
        content: [{ type: "text", text: "   ", styles: {} }],
        children: [],
      },
    ] as never)
    const persistence = {
      loadDocument: vi.fn().mockResolvedValue({ destroy: vi.fn() }),
    }
    const service = makeService(
      createRepo(),
      createWorkspaces(),
      {},
      persistence
    )

    await expect(
      service.exportMarkdown("doc-1", "user-1")
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.exportMarkdown("doc-1", "user-1")).rejects.toThrow(
      "文档没有可索引的正文"
    )
  })
})
