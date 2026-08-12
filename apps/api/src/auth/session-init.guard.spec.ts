import { Test } from "@nestjs/testing"
import { describe, expect, it, vi } from "vitest"
import { AuthService } from "./auth.service"
import { SessionInitGuard } from "./session-init.guard"

describe("SessionInitGuard", () => {
  it("receives AuthService from Nest before resolving a session cookie", async () => {
    const findUserBySessionToken = vi.fn()
    const module = await Test.createTestingModule({
      providers: [
        SessionInitGuard,
        {
          provide: AuthService,
          useValue: { findUserBySessionToken },
        },
      ],
    }).compile()

    // Resolving via Nest catches missing runtime constructor metadata that a
    // direct `new SessionInitGuard(...)` unit test would hide.
    const guard = module.get(SessionInitGuard)
    const request = {
      headers: { cookie: "session_token=token-1" },
    }
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as any

    await expect(guard.canActivate(context)).resolves.toBe(true)
    expect(findUserBySessionToken).toHaveBeenCalledWith("token-1")
  })
})
