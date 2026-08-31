import { Test } from "@nestjs/testing"
import { describe, expect, it, vi } from "vitest"
import { AuthenticatedIdentityGuard } from "@api/auth/authenticated-identity.guard"
import { ENVIRONMENT } from "@api/config/tokens"
import { ImageUploadController } from "@api/images/image-upload.controller"
import { ImageUploadService } from "@api/images/image-upload.service"
import { CosService } from "@api/storage/cos.service"
import { DocumentsService } from "@api/documents/documents.service"

describe("ImageUploadController", () => {
  it("forwards the document, authenticated user, and image metadata", async () => {
    const createPresign = vi.fn().mockResolvedValue({
      uploadUrl: "https://upload.example.com",
      publicUrl: "https://cdn.example.com/images/example.png",
      objectKey: "documents/doc-1/example.png",
      contentType: "image/png",
    })
    const moduleRef = await Test.createTestingModule({
      controllers: [ImageUploadController],
      providers: [
        { provide: ImageUploadService, useValue: { createPresign } },
        {
          provide: ENVIRONMENT,
          useValue: { NODE_ENV: "test" },
        },
      ],
    })
      .overrideGuard(AuthenticatedIdentityGuard)
      .useValue({ canActivate: () => true })
      .compile()
    const controller = moduleRef.get(ImageUploadController)

    await expect(
      controller.createPresign(
        "doc-1",
        { contentType: "image/png", size: 1024 },
        { id: "user-1" }
      )
    ).resolves.toMatchObject({
      objectKey: "documents/doc-1/example.png",
    })
    expect(createPresign).toHaveBeenCalledWith("doc-1", "user-1", {
      contentType: "image/png",
      size: 1024,
    })
  })

  it("declares explicit injection metadata for the tsx runtime", () => {
    expect(
      Reflect.getMetadata("self:paramtypes", ImageUploadController)
    ).toEqual([{ index: 0, param: ImageUploadService }])
    expect(Reflect.getMetadata("self:paramtypes", ImageUploadService)).toEqual([
      { index: 1, param: CosService },
      { index: 0, param: DocumentsService },
    ])
  })
})
