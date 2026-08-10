import {
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
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
    @Inject(DocumentsService) private readonly documents: DocumentsService
  ) {}

  async authenticateConnection(
    input: AuthenticateConnectionInput
  ): Promise<CollaborationConnectionAuth> {
    const userId = this.resolveUserId(input.token, input.requestHeaders)
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
