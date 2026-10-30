import "@testing-library/jest-dom/vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { LibraryDetailPage } from "@/components/libraries/library-detail-page"
import type { LibrarySource, LibrarySummary } from "@/lib/library-api"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

const library: LibrarySummary = {
  id: "lib-1",
  name: "产品资料库",
  role: "owner",
  sourceCount: 1,
  memberCount: 1,
  updatedAt: "2026-01-02T00:00:00.000Z",
  embeddingConfigured: false,
}

const viewerLibrary: LibrarySummary = {
  ...library,
  role: "viewer",
}

const queuedSource: LibrarySource = {
  id: "src-1",
  title: "手册.txt",
  kind: "file",
  status: "queued",
  statusLabel: "索引中",
  errorMessage: null,
  activeGeneration: 0,
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("LibraryDetailPage", () => {
  it("rejects notes.exe without calling upload", async () => {
    const listSources = vi.fn().mockResolvedValue([])
    const uploadSourceFile = vi.fn()
    const fetchLibrary = vi.fn().mockResolvedValue(library)

    render(
      <LibraryDetailPage
        libraryId="lib-1"
        userId="user-1"
        fetchLibrary={fetchLibrary}
        listSources={listSources}
        uploadSourceFile={uploadSourceFile}
      />
    )

    expect(await screen.findByText("产品资料库")).toBeInTheDocument()

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    const file = new File(["binary"], "notes.exe", {
      type: "application/octet-stream",
    })
    fireEvent.change(input, { target: { files: [file] } })

    expect(uploadSourceFile).not.toHaveBeenCalled()
    expect(
      screen.getByText("只支持 txt、md、pdf、docx 文件")
    ).toBeInTheDocument()
  })

  it("shows 索引中 for queued sources and refreshes on a fake 3s timer", async () => {
    vi.useFakeTimers()
    const listSources = vi.fn().mockResolvedValue([queuedSource])
    const fetchLibrary = vi.fn().mockResolvedValue(library)

    render(
      <LibraryDetailPage
        libraryId="lib-1"
        userId="user-1"
        fetchLibrary={fetchLibrary}
        listSources={listSources}
      />
    )

    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText("索引中")).toBeInTheDocument()
    expect(listSources).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    expect(listSources).toHaveBeenCalledTimes(2)
  })

  it("saves only the api key from the owner embedding dialog", async () => {
    const confirmSpy = vi.fn()
    vi.stubGlobal("confirm", confirmSpy)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        openAiBaseUrl: "https://api.openai.com/v1",
        openAiEmbeddingModel: "",
        hasApiKey: true,
        modelChanged: false,
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    render(
      <LibraryDetailPage
        libraryId="lib-1"
        userId="user-1"
        fetchLibrary={vi.fn().mockResolvedValue(library)}
        listSources={vi.fn().mockResolvedValue([])}
      />
    )

    expect(await screen.findByText("产品资料库")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "嵌入配置" }))
    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "sk-test" },
    })
    fireEvent.click(screen.getByRole("button", { name: "保存" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    const putCall = fetchMock.mock.calls.find((call) => {
      const init = call[1] as RequestInit | undefined
      return init?.method === "PUT"
    })
    expect(putCall).toBeDefined()
    const body = JSON.parse(String((putCall?.[1] as RequestInit).body)) as {
      openAiApiKey?: string
      openAiBaseUrl?: string
      openAiEmbeddingModel?: string
    }
    expect(body).toEqual({ openAiApiKey: "sk-test" })
    expect(body).not.toHaveProperty("openAiBaseUrl")
    expect(body).not.toHaveProperty("openAiEmbeddingModel")
    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it("imports a document chosen from title search", async () => {
    const searchDocuments = vi
      .fn()
      .mockResolvedValue([{ id: "doc-42", title: "产品需求文档" }])
    const importDocument = vi.fn().mockResolvedValue({ id: "src-new" })

    render(
      <LibraryDetailPage
        libraryId="lib-1"
        userId="user-1"
        fetchLibrary={vi.fn().mockResolvedValue(library)}
        listSources={vi.fn().mockResolvedValue([])}
        searchDocuments={searchDocuments}
        importDocument={importDocument}
      />
    )

    expect(await screen.findByText("产品资料库")).toBeInTheDocument()
    expect(screen.queryByPlaceholderText("文档 ID")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "上传文件" })).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText("搜索站内文档并导入"), {
      target: { value: "产品" },
    })

    expect(await screen.findByText("产品需求文档")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "产品需求文档" }))

    await waitFor(() => {
      expect(importDocument).toHaveBeenCalledWith("lib-1", "user-1", "doc-42")
    })
  })

  it("refreshes sources when embedding save reports modelChanged", async () => {
    const confirmSpy = vi.fn().mockReturnValue(true)
    vi.stubGlobal("confirm", confirmSpy)
    const listSources = vi.fn().mockResolvedValue([])
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        openAiBaseUrl: "https://api.openai.com/v1",
        openAiEmbeddingModel: "text-embedding-3-large",
        hasApiKey: true,
        modelChanged: true,
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    render(
      <LibraryDetailPage
        libraryId="lib-1"
        userId="user-1"
        fetchLibrary={vi.fn().mockResolvedValue(library)}
        listSources={listSources}
      />
    )

    expect(await screen.findByText("产品资料库")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "嵌入配置" }))
    fireEvent.change(screen.getByLabelText("模型名称"), {
      target: { value: "text-embedding-3-large" },
    })
    fireEvent.click(screen.getByRole("button", { name: "保存" }))

    await waitFor(() => {
      expect(listSources.mock.calls.length).toBeGreaterThan(1)
    })
  })

  it("hides the contact-owner hint from owners", async () => {
    render(
      <LibraryDetailPage
        libraryId="lib-1"
        userId="user-1"
        fetchLibrary={vi.fn().mockResolvedValue(library)}
        listSources={vi.fn().mockResolvedValue([])}
      />
    )

    expect(await screen.findByText("产品资料库")).toBeInTheDocument()
    expect(
      screen.queryByText("请联系资料库所有者配置嵌入模型")
    ).not.toBeInTheDocument()
  })

  it("links viewers to the standalone ask page", async () => {
    render(
      <LibraryDetailPage
        libraryId="lib-1"
        userId="user-1"
        fetchLibrary={vi.fn().mockResolvedValue(viewerLibrary)}
        listSources={vi.fn().mockResolvedValue([])}
      />
    )

    expect(await screen.findByText("产品资料库")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "去问答" })).toHaveAttribute(
      "href",
      "/libraries/ask/lib-1"
    )
  })
})
