export interface ShareLinkRow {
  token: string
  document_id: string
  created_by: string
  created_at: Date
  revoked_at: Date | null
}
