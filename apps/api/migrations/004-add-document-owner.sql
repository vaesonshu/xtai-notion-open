-- Up Migration

ALTER TABLE document
  ADD COLUMN owner_id UUID REFERENCES app_user (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS document_owner_id_idx ON document (owner_id);

-- Down Migration

ALTER TABLE document DROP COLUMN IF EXISTS owner_id;
DROP INDEX IF EXISTS document_owner_id_idx;
