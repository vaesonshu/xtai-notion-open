/** 每位用户可拥有的未删除「自有」文档数量上限（owner_id）。 */
export const USER_DOCUMENT_QUOTA = 10

export type OwnedDocumentQuota = {
  used: number
  limit: number
}
