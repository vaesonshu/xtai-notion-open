-- Up Migration

-- Existing documents become drafts so no pre-existing content becomes public.
ALTER TABLE app_user
  ADD COLUMN role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin'));

ALTER TABLE document
  ADD COLUMN publication_status TEXT NOT NULL DEFAULT 'draft'
  CHECK (publication_status IN ('draft', 'pending', 'published')),
  ADD COLUMN rejection_reason TEXT,
  ADD COLUMN published_at TIMESTAMPTZ,
  ADD COLUMN published_by UUID REFERENCES app_user (id) ON DELETE SET NULL;

CREATE INDEX document_publication_status_idx
  ON document (publication_status, updated_at DESC);

-- Down Migration

DROP INDEX IF EXISTS document_publication_status_idx;
ALTER TABLE document DROP COLUMN IF EXISTS published_by;
ALTER TABLE document DROP COLUMN IF EXISTS published_at;
ALTER TABLE document DROP COLUMN IF EXISTS rejection_reason;
ALTER TABLE document DROP COLUMN IF EXISTS publication_status;
ALTER TABLE app_user DROP COLUMN IF EXISTS role;
