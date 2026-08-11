-- Up Migration

ALTER TABLE document
  ADD COLUMN parent_id UUID REFERENCES document (id) ON DELETE CASCADE,
  ADD COLUMN depth INTEGER NOT NULL DEFAULT 1 CHECK (depth BETWEEN 1 AND 3);

CREATE INDEX document_parent_id_idx ON document (parent_id);

-- Down Migration

DROP INDEX IF EXISTS document_parent_id_idx;
ALTER TABLE document DROP COLUMN IF EXISTS depth;
ALTER TABLE document DROP COLUMN IF EXISTS parent_id;
