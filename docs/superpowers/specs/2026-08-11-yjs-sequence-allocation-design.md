# Yjs Sequence Allocation Concurrency Fix

## Problem

`YjsPersistenceRepository.insertUpdates` calculates the next sequence from the
current maximum and inserts a batch in one transaction. Concurrent transactions
for the same document can observe the same maximum and attempt to insert the
same `(document_id, sequence)` pair, causing PostgreSQL error `23505`.

## Design

Before calculating the next sequence, the transaction will lock the parent
`document` row with `SELECT ... FOR UPDATE`. The lock is scoped to the current
transaction, so concurrent writers for the same document wait and then observe
the committed maximum from the preceding writer. Writers for different
documents remain independent.

The lock and sequence calculation must use the same transaction client as the
updates. No migration or retry policy is required. If the document no longer
exists, the existing foreign-key behavior remains authoritative.

## Verification

Add a repository regression test that verifies the document lock is acquired
before the maximum sequence is read and before updates are inserted. Run the
focused API test suite, type checking, and linting. When a configured PostgreSQL
integration database is available, run the collaboration integration suite as
well.

## Scope

This change only serializes update sequence allocation. It does not change Yjs
buffering, compaction thresholds, schema constraints, or the application's SSL
configuration.
