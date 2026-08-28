import { describe, expect, it, vi } from "vitest"
import type { BinaryFiles } from "@excalidraw/excalidraw/types"
import { externalizeCanvasFiles, inlineRemoteCanvasFiles } from "./canvas-files"

describe("externalizeCanvasFiles", () => {
  it("uploads data URL files and replaces with public URLs", async () => {
    const upload = vi.fn().mockResolvedValue({
      publicUrl: "https://cdn.example.com/canvas.png",
      contentType: "image/png",
    })

    const files = {
      "file-1": {
        id: "file-1",
        mimeType: "image/png",
        created: 1,
        dataURL:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      },
    } as unknown as BinaryFiles

    const result = await externalizeCanvasFiles(files, upload)

    expect(upload).toHaveBeenCalledTimes(1)
    expect(result?.["file-1"]?.dataURL).toBe(
      "https://cdn.example.com/canvas.png"
    )
  })

  it("skips files that are already hosted remotely", async () => {
    const upload = vi.fn()
    const files = {
      "file-1": {
        id: "file-1",
        mimeType: "image/png",
        created: 1,
        dataURL: "https://cdn.example.com/existing.png",
      },
    } as unknown as BinaryFiles

    const result = await externalizeCanvasFiles(files, upload)

    expect(upload).not.toHaveBeenCalled()
    expect(result).toBe(files)
  })

  it("inlines remote image URLs before export", async () => {
    const fetchRemote = vi
      .fn()
      .mockResolvedValue(new Blob(["pixels"], { type: "image/png" }))
    const files = {
      "file-1": {
        id: "file-1",
        mimeType: "image/png",
        created: 1,
        dataURL: "https://cdn.example.com/existing.png",
      },
    } as unknown as BinaryFiles

    const result = await inlineRemoteCanvasFiles(files, fetchRemote)

    expect(fetchRemote).toHaveBeenCalledWith(
      "https://cdn.example.com/existing.png",
      undefined
    )
    expect(result["file-1"]?.dataURL).toMatch(/^data:image\/png;base64,/)
  })
})
