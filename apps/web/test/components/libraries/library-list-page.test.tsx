import "@testing-library/jest-dom/vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { LibraryListPage } from "@/components/libraries/library-list-page"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("LibraryListPage", () => {
  it("renders library names and roles from the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: "lib-1",
            name: "产品资料库",
            role: "owner",
            sourceCount: 3,
            memberCount: 2,
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
          {
            id: "lib-2",
            name: "设计规范",
            role: "viewer",
            sourceCount: 1,
            memberCount: 4,
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      })
    )

    render(<LibraryListPage userId="user-1" />)

    expect(await screen.findByText("产品资料库")).toBeInTheDocument()
    expect(screen.getByText("所有者")).toBeInTheDocument()
    expect(screen.getByText("设计规范")).toBeInTheDocument()
    expect(screen.getByText("查看者")).toBeInTheDocument()
  })

  it("submits the trimmed library name when creating", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, options?: RequestInit) => {
        if ((options?.method ?? "GET") === "POST") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: "lib-new",
              name: "产品资料",
              role: "owner",
              sourceCount: 0,
              memberCount: 1,
              updatedAt: "2026-01-03T00:00:00.000Z",
            }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => [],
        })
      })
    vi.stubGlobal("fetch", fetchMock)

    render(<LibraryListPage userId="user-1" />)
    expect(
      await screen.findByText("还没有资料库，先创建一个吧")
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "新建资料库" }))
    fireEvent.change(screen.getByPlaceholderText("资料库名称"), {
      target: { value: "  产品资料  " },
    })
    fireEvent.click(screen.getByRole("button", { name: "创建" }))

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        ([, options]) => (options as RequestInit | undefined)?.method === "POST"
      )
      expect(postCall).toBeDefined()
      expect(JSON.parse((postCall?.[1] as RequestInit).body as string)).toEqual(
        { name: "产品资料" }
      )
    })
    expect(await screen.findByText("产品资料")).toBeInTheDocument()
  })
})
