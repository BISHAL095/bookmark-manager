# Bookmark Manager GraphQL API

A GraphQL API for organizing bookmarks into folders, with search and cursor-based pagination. Built with Bun, TypeScript (strict mode), GraphQL Yoga (schema-first), Prisma, and PostgreSQL.

## Setup

```bash
git clone <your-repo-url>
cd bookmark-manager
docker compose up -d
bun install
bunx prisma migrate dev
bun run dev
```

The server starts at `http://localhost:4000/graphql`, with GraphiQL available in the browser for interactive queries.

> **Troubleshooting:** if `prisma migrate dev` or the server fails to connect to Postgres, something else may already be listening on port `5432` (a native Postgres install, Postgres.app, a Homebrew `postgresql` service, etc.). Check with `lsof -nP -iTCP:5432 -sTCP:LISTEN` and stop the conflicting process before starting the Docker container.

## Environment Variables

Create a `.env` file at the project root (see `.env.example`):

```
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/bookmark_manager"
```

This must match the credentials in `docker-compose.yml` (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`).

## Database

- **PostgreSQL** runs via Docker Compose (`docker-compose.yml`), with data persisted in a named volume.
- **Prisma** manages the schema and migrations (`prisma/schema.prisma`). Migrations are generated with `bunx prisma migrate dev --name <description>` — never hand-written.
- The `Folder` → `Bookmark` relationship uses `onDelete: Cascade`: deleting a folder deletes its bookmarks. This was a deliberate choice for simplicity; a production system might prefer `Restrict` to force explicit handling of a folder's contents before deletion.
- Both models use `uuid()` primary keys.
- Indexes: `title` (for search), `folderId` (for folder filtering), and a composite `(createdAt, id)` index supporting cursor pagination (see below).

## Running Tests

```bash
bun test
```

This runs both:
- **Unit tests** (`tests/unit/`) — resolver logic tested with a mocked Prisma client, no database required. Covers query filtering logic, and validation/error paths (empty title, moving a bookmark to a non-existent folder).
- **Integration tests** (`tests/integration/`) — run against the real Dockerized PostgreSQL database. Requires `docker compose up -d` to be running first. Covers a full create-and-query round trip through the actual resolvers, plus an end-to-end verification of cursor pagination across multiple pages with no overlap or gaps.

> Note: the integration test suite clears the `Bookmark` and `Folder` tables before each test (`deleteMany()`). Avoid running `bun test` against a database you care about keeping data in — it shares the same `DATABASE_URL` as local development.

## API

### Queries

| Query | Description |
|---|---|
| `folders` | Returns all folders. |
| `folder(id)` | Returns a single folder and its nested bookmarks, or `null` if not found. |
| `bookmarks(folderId, search, take, cursor)` | Returns a paginated page of bookmarks, optionally filtered by folder and/or a substring match on title. |

### Mutations

| Mutation | Description |
|---|---|
| `createFolder(name)` | Creates a folder. |
| `createBookmark(title, url, tags, folderId)` | Creates a bookmark. Rejects empty/whitespace titles and malformed URLs. |
| `updateBookmark(id, title?, url?, tags?)` | Partially updates a bookmark. Validates any provided title/url. Throws if the bookmark doesn't exist. |
| `deleteBookmark(id)` | Deletes a bookmark, returning its `id`. Throws if not found. |
| `moveBookmark(id, folderId)` | Moves a bookmark to another folder. Throws if the target folder or the bookmark doesn't exist. |

## Pagination Approach

`bookmarks` uses **cursor-based (keyset) pagination** over a composite `(createdAt, id)` key, rather than `skip`/`offset`, so results stay correct even as new bookmarks are inserted between page requests.

- **Cursor shape:** each cursor encodes `{ createdAt, id }` for the last item on the current page, JSON-stringified and base64-encoded into a single opaque string. Clients aren't expected to construct or interpret it — just pass back whatever `nextCursor` they received.
- **Why a composite key, not `createdAt` alone:** two bookmarks can share the same millisecond-level timestamp (this happened in testing when several were created in a tight loop). `id` (a UUID) breaks ties deterministically, so pagination never skips or repeats a row.
- **The comparison:** given a decoded cursor, the next page fetches rows where `createdAt < cursor.createdAt`, **or** `createdAt = cursor.createdAt AND id < cursor.id`, sorted `DESC` on both fields — the standard keyset-pagination predicate for a composite sort key.
- **Detecting `hasNextPage`:** rather than a separate `COUNT` query, the resolver fetches `take + 1` rows. If the extra row comes back, there's a next page; it's sliced off before returning results to the client.
- **Combining with other filters:** `folderId`, `search`, and the cursor condition are each built as independent Prisma `where` fragments and combined via `AND`, since both `search` and the cursor condition need their own `OR` — a single object can't hold two `OR` keys without one overwriting the other.

## How I'd Extend This

- **Authentication & Authorization** — scope folders/bookmarks to a signed-in user, with row-level ownership checks in resolvers.
- **Caching** — a per-request DataLoader for `Folder`/`Bookmark` lookups to avoid N+1 queries if nested fetching grows, plus a response cache (e.g. Redis) for frequently-read queries like `folders`.
- **Search improvements** — the current substring search on `title` uses a plain B-tree index, which doesn't accelerate leading-wildcard (`%term%`) matches. A production system would add `pg_trgm` or a dedicated full-text/search index, and likely extend search to `url`/`tags` as well.
- **Observability** — structured logging per resolver, request tracing, and query performance metrics (especially around pagination and search).
- **API versioning** — schema evolution strategy (deprecating fields via `@deprecated` before removal, avoiding breaking changes to existing clients).
- **Scaling** — connection pooling tuning (e.g. PgBouncer) as concurrent load grows, and read replicas if read traffic dominates.

## AI Assistance

All schema, resolver, and test code in this project was designed and written by me. Claude (Anthropic) was used as a review/guidance tool throughout — I made every design decision, wrote every line of implementation code, and ran/debugged everything myself. Specifically, Claude was used to:

- **Review code after each step** and flag issues before moving on — e.g. catching a `Prisma.BookmarkWhereInput` type replacing an `any` I'd initially reached for, an unhandled Prisma exception in `updateBookmark`/`deleteBookmark` that needed converting to a proper `GraphQLError`, and stale unit test assertions after the `bookmarks` resolver's shape changed for pagination.
- **Explain concepts I was unfamiliar with** before I implemented them myself — e.g. what the GraphQL resolver `(parent, args, context, info)` signature does, the tradeoffs between Relay-style `Connection` pagination and a simpler custom payload, and why a composite `(createdAt, id)` cursor is needed over a single-field cursor.
- **Debug environment/tooling issues** — most notably a Postgres port-5432 conflict between a native Postgres.app installation and the Docker container, which produced confusing, inconsistent connection errors until traced to its root cause via `lsof`.
- **Draft this README** by consolidating the design decisions and explanations from our working session into the sections above; I reviewed it for accuracy against the actual implementation before committing it.

No production code (resolvers, schema, Prisma models, or tests) was generated wholesale by AI — each was written by me first, then reviewed.

## Design Decisions & Tradeoffs

- **Error handling uses a blanket `catch`** around Prisma update/delete calls, converting any failure into a generic "not found" `GraphQLError`, rather than checking Prisma's specific error code (`P2025`). This is simple and covers the required cases, but would mask a different underlying failure (e.g. a connection issue) as "not found." A production system would narrow this to the specific error code.
- **`createBookmark`/`updateBookmark` take individual scalar arguments** rather than an `input` object type. At this field count (4), either is reasonable; input objects would pay off more as the mutation surface grows.
- **`deleteBookmark` returns the deleted `id`** rather than the full entity or a boolean, on the reasoning that the client already has the bookmark's data before deleting it and mainly needs confirmation of which one was removed.
- **No authentication, caching, or infrastructure beyond what's required** — kept out deliberately to stay within the assignment's intended scope.