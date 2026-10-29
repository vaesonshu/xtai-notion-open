import { describe, expect, it, vi } from "vitest"
import { CosService } from "@api/storage/cos.service"

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

  it("rejects initialization when a signing environment variable is missing", () => {
    for (const key of [
      "COS_SECRET_ID",
      "COS_SECRET_KEY",
      "COS_BUCKET",
      "COS_REGION",
    ] as const) {
      const incomplete = { ...environment }
      delete incomplete[key as keyof typeof environment]

      const service = new CosService(incomplete)
      expect(() => service.createPutPresign(request)).toThrow(
        `Missing required environment variable: ${key}`
      )
    }
  })

  it("returns a signed PUT URL and public URL for a valid request", () => {
    const getAuthorization = vi.fn(
      () =>
        "q-sign-algorithm=sha1&q-ak=secret-id&q-sign-time=1;2&q-sign=signature"
    )
    const service = new CosService(environment, { getAuthorization })

    const result = service.createPutPresign(request)

    expect(result).toEqual({
      uploadUrl:
        "https://examplebucket-1250000000.cos.ap-guangzhou.myqcloud.com/documents/document-1/asset.png?q-sign-algorithm=sha1&q-ak=secret-id&q-sign-time=1;2&q-sign=signature",
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
        Expires: 300,
      })
    )
  })

  it("uses the COS public URL when no custom public base URL is configured", () => {
    const service = new CosService(
      { ...environment, COS_PUBLIC_BASE_URL: undefined },
      { getAuthorization: () => "q-sign=signature" }
    )

    expect(service.createPutPresign(request).publicUrl).toBe(
      "https://examplebucket-1250000000.cos.ap-guangzhou.myqcloud.com/documents/document-1/asset.png"
    )
  })

  it("uploads binary data through the server-side COS client", async () => {
    const putObject = vi.fn().mockResolvedValue({ ETag: "etag" })
    const body = Buffer.from("image")
    const service = new CosService(
      { ...environment, COS_PUBLIC_BASE_URL: undefined },
      { getAuthorization: () => "q-sign=signature" },
      undefined,
      { putObject }
    )

    await expect(service.putObject({ ...request, body })).resolves.toEqual({
      publicUrl:
        "https://examplebucket-1250000000.cos.ap-guangzhou.myqcloud.com/documents/document-1/asset.png",
      objectKey: request.objectKey,
      contentType: request.contentType,
    })
    expect(putObject).toHaveBeenCalledWith({
      Bucket: environment.COS_BUCKET,
      Region: environment.COS_REGION,
      Key: request.objectKey,
      Body: body,
      ContentLength: body.length,
      ContentType: request.contentType,
    })
  })

  it("deletes an object through the server-side COS client", async () => {
    const deleteObject = vi.fn().mockResolvedValue({})
    const service = new CosService(
      { ...environment, COS_PUBLIC_BASE_URL: undefined },
      { getAuthorization: () => "q-sign=signature" },
      undefined,
      { putObject: vi.fn(), deleteObject }
    )

    await expect(
      service.deleteObject("knowledge/lib-1/src-1/notes.txt")
    ).resolves.toBeUndefined()
    expect(deleteObject).toHaveBeenCalledWith({
      Bucket: environment.COS_BUCKET,
      Region: environment.COS_REGION,
      Key: "knowledge/lib-1/src-1/notes.txt",
    })
  })

  it("does not expose secrets in errors or logs", () => {
    const logger = { error: vi.fn() }
    const getAuthorization = vi.fn(() => {
      throw new Error("signing failed: secret-key?q-sign=signature")
    })
    const service = new CosService(environment, { getAuthorization }, logger)

    expect(() => service.createPutPresign(request)).toThrow("signing failed")
    expect(logger.error).toHaveBeenCalled()

    const output = JSON.stringify(logger.error.mock.calls)
    expect(output).not.toContain(environment.COS_SECRET_ID)
    expect(output).not.toContain(environment.COS_SECRET_KEY)
    expect(output).not.toContain("q-sign=signature")
  })

  it("resolves hosted image object keys from CDN and COS URLs", () => {
    const service = new CosService(environment, {
      getAuthorization: () => "q-sign=signature",
    })

    expect(
      service.resolveHostedImageObjectKey(
        "https://cdn.example.com/images/documents/document-1/asset.png"
      )
    ).toBe("documents/document-1/asset.png")
    expect(
      service.resolveHostedImageObjectKey(
        "https://examplebucket-1250000000.cos.ap-guangzhou.myqcloud.com/documents/document-1/asset.png"
      )
    ).toBe("documents/document-1/asset.png")
    expect(
      service.resolveHostedImageObjectKey("https://evil.example.com/asset.png")
    ).toBeNull()
  })
})
