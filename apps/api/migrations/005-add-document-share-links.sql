-- Up Migration

CREATE TABLE document_share_link (
  token TEXT PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES document (id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

-- A document can have one reusable active link while retaining revoked history.
CREATE UNIQUE INDEX document_share_link_active_document_idx
  ON document_share_link (document_id)
  WHERE revoked_at IS NULL;

-- Down Migration

DROP INDEX IF EXISTS document_share_link_active_document_idx;
DROP TABLE IF EXISTS document_share_link;
