-- Up Migration

CREATE TABLE workspace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace (id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX document_workspace_id_idx ON document (workspace_id);

CREATE TABLE document_member (
  document_id UUID NOT NULL REFERENCES document (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, user_id)
);

CREATE INDEX document_member_user_id_idx ON document_member (user_id);

CREATE TABLE yjs_snapshot (
  id BIGSERIAL PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES document (id) ON DELETE CASCADE,
  snapshot BYTEA NOT NULL,
  sequence BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX yjs_snapshot_document_id_sequence_idx
  ON yjs_snapshot (document_id, sequence DESC);

CREATE TABLE yjs_update (
  id BIGSERIAL PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES document (id) ON DELETE CASCADE,
  sequence BIGINT NOT NULL,
  "update" BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT yjs_update_document_id_sequence_key UNIQUE (document_id, sequence)
);

-- Down Migration

DROP TABLE IF EXISTS yjs_update;
DROP TABLE IF EXISTS yjs_snapshot;
DROP TABLE IF EXISTS document_member;
DROP TABLE IF EXISTS document;
DROP TABLE IF EXISTS workspace;
