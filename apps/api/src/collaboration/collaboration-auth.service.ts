import { Inject, Injectable, UnauthorizedException } from "@nestjs/common"
import { AuthService } from "../auth/auth.service"
import { DEV_USER_HEADER } from "../auth/dev-user"
import type { DocumentRole } from "../documents/document-types"
import { DocumentsService } from "../documents/documents.service"

export type CollaborationConnectionAuth = {
  userId: string
  role: DocumentRole
  readOnly: boolean
}

export type AuthenticateConnectionInput = {
  documentId: string
  token: string
  requestHeaders: Record<string, string | string[] | undefined>
}

@Injectable()
export class CollaborationAuthService {
  constructor(
    @Inject(DocumentsService) private readonly documents: DocumentsService,
    @Inject(AuthService) private readonly authService: AuthService
  ) {}

  async authenticateConnection(
    input: AuthenticateConnectionInput
  ): Promise<CollaborationConnectionAuth> {
    // Resolve user id either from token (legacy) or from dev header. If both
    // are empty, try to parse a session cookie from the request headers and
    // map it to a user via AuthService (session-based auth path).
    const userIdFromToken = this.resolveUserId(input.token, input.requestHeaders)
    let userId = userIdFromToken
    if (!userId) {
      const cookieHeader = input.requestHeaders?.cookie as string | undefined
      if (cookieHeader) {
        const tokenPair = cookieHeader
          .split(";")
          .map((p) => p.trim())
          .find((p) => p.startsWith("session_token="))
        if (tokenPair) {
          const tokenValue = decodeURIComponent(tokenPair.split("=").slice(1).join("="))
          const user = await (this as any).authService?.findUserBySessionToken?.(tokenValue)
          userId = user?.id ?? ""
        }
      }
    }
    if (!userId) {
      throw new UnauthorizedException(
        `Missing collaboration identity (token or ${DEV_USER_HEADER})`
      )
    }

    const role = await this.documents.assertCanRead(input.documentId, userId)
    return {
      userId,
      role,
      readOnly: role === "viewer",
    }
  }

  private resolveUserId(
    token: string,
    requestHeaders: Record<string, string | string[] | undefined>
  ): string {
    const fromToken = token.trim()
    if (fromToken) {
      return fromToken
    }

    const raw = requestHeaders[DEV_USER_HEADER]
    const value = Array.isArray(raw) ? raw[0] : raw
    return typeof value === "string" ? value.trim() : ""
  }
}
