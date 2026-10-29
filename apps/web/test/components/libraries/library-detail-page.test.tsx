import "@testing-library/jest-dom/vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
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
})
