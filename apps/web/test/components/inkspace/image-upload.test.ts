import { describe, expect, it, vi } from "vitest"
import {
  createDocumentCanvasImageFetcher,
  createDocumentImageUploader,
} from "@/components/inkspace/image-upload"

const file = new File(["image"], "image.png", { type: "image/png" })

describe("createDocumentImageUploader", () => {
  it("uploads the original file to the API without contacting COS from the browser", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ publicUrl: "https://cdn.example.test/image.png" })
        )
      )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      createDocumentImageUploader({
        apiUrl: "https://api.example.test/",
        documentId: "document-1",
        userId: "user-1",
      })(file)
    ).resolves.toEqual({
      publicUrl: "https://cdn.example.test/image.png",
      contentType: "image/png",
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/documents/document-1/images",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) })
    )
    const [requestUrl, requestOptions] = fetchMock.mock.calls[0]!
    expect(requestUrl).toBe(
      "https://api.example.test/documents/document-1/images"
    )
    const formData = (requestOptions as RequestInit).body as FormData
    expect(formData.get("file")).toBe(file)
  })

  it("rejects unsuccessful API upload responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 403 }))
    )
    const uploader = createDocumentImageUploader({
      apiUrl: "https://api.example.test",
      documentId: "document-1",
      userId: "user-1",
    })

    await expect(uploader(file)).rejects.toThrow("Image upload failed (403)")
  })

  it("maps API network errors to an API connectivity message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch"))
    )
    const uploader = createDocumentImageUploader({
      apiUrl: "https://api.example.test",
      documentId: "document-1",
      userId: "user-1",
    })

    await expect(uploader(file)).rejects.toThrow(
      "无法连接到图片上传服务。请检查 API 是否已启动或网络连接。"
    )
  })
})

describe("createDocumentCanvasImageFetcher", () => {
  it("fetches canvas images through the API proxy", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("image-bytes", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const blob = await createDocumentCanvasImageFetcher({
      apiUrl: "https://api.example.test",
      documentId: "document-1",
      userId: "user-1",
    })("https://cdn.example.test/documents/document-1/image.png")

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/documents/document-1/images/proxy?url=https%3A%2F%2Fcdn.example.test%2Fdocuments%2Fdocument-1%2Fimage.png",
      expect.objectContaining({
        credentials: "include",
        headers: { "x-dev-user-id": "user-1" },
      })
    )
    expect(await blob.text()).toBe("image-bytes")
  })
})
