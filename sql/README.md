# Applying schema

Migrations are ordered and numbered. Apply in sequence, in the Supabase SQL
Editor or via `psql`:

```
sql/001_core.sql          # profiles, meetings, action_items, key_decisions + RLS
sql/002_extensions.sql    # tags, notes, segments, templates, metrics, storage, search
sql/vector_migration.sql  # pgvector embeddings + match_meetings RPC (optional)
```

All three are idempotent — re-running is safe.

## Why the split

`001_core.sql` holds the four tables that existed before `schema.sql` was
written. `schema.sql` only ever `ALTER`ed them, so a fresh database could not be
built from this repo. `002_extensions.sql` is everything `schema.sql` adds.

`schema.sql` is retained for existing deployments that already ran it. **New
deployments should use `001` + `002` instead** — it covers the same ground with
complete RLS and no reliance on pre-existing state.

## After applying

Semantic search silently falls back to Postgres full-text search until
`vector_migration.sql` has been run, so it is optional.
