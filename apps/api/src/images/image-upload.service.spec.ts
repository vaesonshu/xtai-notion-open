import {
  BadRequestException,
  ForbiddenException,
  PayloadTooLargeException,
} from "@nestjs/common"
import { describe, expect, it, vi } from "vitest"
import type { DocumentsService } from "../documents/documents.service"
import type { CosService } from "../storage/cos.service"
import type { PresignImageRequest } from "./image-upload.types"
import { ImageUploadService } from "./image-upload.service"

function createService() {
  const documents = {
    assertCanWrite: vi.fn().mockResolvedValue("editor"),
  } as unknown as DocumentsService
  const cos = {
    createPutPresign: vi.fn((input) => ({
      uploadUrl: "https://upload.example.com",
      publicUrl: `https://cdn.example.com/${input.objectKey}`,
      ...input,
    })),
    putObject: vi.fn((input) => ({
      publicUrl: `https://cdn.example.com/${input.objectKey}`,
      ...input,
    })),
  } as unknown as CosService

  return { service: new ImageUploadService(documents, cos), documents, cos }
}

describe("ImageUploadService", () => {
  it("uploads an authorized image through the server-side COS client", async () => {
    const { service, documents, cos } = createService()
    const buffer = Buffer.from("image")

    await expect(
      service.upload("doc-1", "user-1", {
        buffer,
        mimetype: "image/png",
        size: buffer.length,
      })
    ).resolves.toEqual({
      publicUrl: expect.stringMatching(
        /^https:\/\/cdn\.example\.com\/documents\/doc-1\//
      ),
      contentType: "image/png",
    })
    expect(documents.assertCanWrite).toHaveBeenCalledWith("doc-1", "user-1")
    expect(cos.putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        body: buffer,
        contentType: "image/png",
        objectKey: expect.stringMatching(/^documents\/doc-1\/[0-9a-f-]+\.png$/),
      })
    )
  })

  it("authorizes, validates supported images, and generates a server-owned key", async () => {
    const { service, documents, cos } = createService()

    const result = await service.createPresign("doc-1", "user-1", {
      contentType: "image/png",
      size: 1024,
    })

    expect(documents.assertCanWrite).toHaveBeenCalledWith("doc-1", "user-1")
    expect(cos.createPutPresign).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: "image/png",
        objectKey: expect.stringMatching(/^documents\/doc-1\/[0-9a-f-]+\.png$/),
      })
    )
    expect(result.publicUrl).toMatch(
      /^https:\/\/cdn\.example\.com\/documents\/doc-1\//
    )
  })

  it.each(["image/jpeg", "image/png", "image/gif", "image/webp"])(
    "accepts %s at the 10MB limit",
    async (contentType) => {
      const { service, cos } = createService()

      await expect(
        service.createPresign("doc-1", "user-1", {
          contentType,
          size: 10 * 1024 * 1024,
        })
      ).resolves.toBeDefined()
      expect(cos.createPutPresign).toHaveBeenCalledOnce()
    }
  )

  it("rejects unsupported or invalid image metadata after authorization", async () => {
    const cases: Array<[PresignImageRequest, typeof BadRequestException]> = [
      [{ contentType: "image/svg+xml", size: 1 }, BadRequestException],
      [{ contentType: "image/png", size: -1 }, BadRequestException],
      [{ contentType: "image/png", size: Number.NaN }, BadRequestException],
    ]

    for (const [request, exception] of cases) {
      const { service, cos } = createService()
      await expect(
        service.createPresign("doc-1", "user-1", request)
      ).rejects.toBeInstanceOf(exception)
      expect(cos.createPutPresign).not.toHaveBeenCalled()
    }
  })

  it("rejects images larger than 10MB", async () => {
    const { service, cos } = createService()

    await expect(
      service.createPresign("doc-1", "user-1", {
        contentType: "image/png",
        size: 10 * 1024 * 1024 + 1,
      })
    ).rejects.toBeInstanceOf(PayloadTooLargeException)
    expect(cos.createPutPresign).not.toHaveBeenCalled()
  })

  it("propagates write authorization failures before metadata validation", async () => {
    const { service, documents, cos } = createService()
    vi.mocked(documents.assertCanWrite).mockRejectedValue(
      new ForbiddenException("Viewer cannot write to document")
    )

    await expect(
      service.createPresign("doc-1", "viewer-1", {
        contentType: "image/svg+xml",
        size: 1,
      })
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(cos.createPutPresign).not.toHaveBeenCalled()
  })
})
