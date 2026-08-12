import { describe, expect, it, vi } from "vitest"
import { CosService } from "./cos.service"

describe("CosService", () => {
  const request = {
    objectKey: "documents/document-1/asset.png",
    contentType: "image/png",
  }

  const environment = {
    COS_SECRET_ID: "secret-id",
    COS_SECRET_KEY: "secret-key",
    COS_BUCKET: "examplebucket-1250000000",
    COS_REGION: "ap-guangzhou",
    COS_PUBLIC_BASE_URL: "https://cdn.example.com/images",
  }

  it("rejects initialization when any COS environment variable is missing", () => {
    for (const key of Object.keys(environment)) {
      const incomplete = { ...environment }
      delete incomplete[key as keyof typeof environment]

      expect(() => new CosService(incomplete)).toThrow(
        `Missing required environment variable: ${key}`
      )
    }
  })

  it("returns a signed PUT URL and public URL for a valid request", () => {
    const getAuthorization = vi.fn(() => "signed-authorization")
    const service = new CosService(environment, { getAuthorization })

    const result = service.createPutPresign(request)

    expect(result).toEqual({
      uploadUrl:
        "https://examplebucket-1250000000.cos.ap-guangzhou.myqcloud.com/documents/document-1/asset.png?sign=signed-authorization",
      publicUrl:
        "https://cdn.example.com/images/documents/document-1/asset.png",
      objectKey: request.objectKey,
      contentType: request.contentType,
    })
    expect(getAuthorization).toHaveBeenCalledWith(
      expect.objectContaining({
        Method: "PUT",
        Key: request.objectKey,
        Headers: { "Content-Type": request.contentType },
        Expires: expect.any(Number),
      })
    )
  })

  it("does not expose secrets in errors or logs", () => {
    const logger = { error: vi.fn() }
    const getAuthorization = vi.fn(() => {
      throw new Error("signing failed")
    })
    const service = new CosService(environment, { getAuthorization }, logger)

    expect(() => service.createPutPresign(request)).toThrow("signing failed")
    expect(logger.error).toHaveBeenCalled()

    const output = JSON.stringify([logger.error.mock.calls, "signing failed"])
    expect(output).not.toContain(environment.COS_SECRET_ID)
    expect(output).not.toContain(environment.COS_SECRET_KEY)
  })
})
