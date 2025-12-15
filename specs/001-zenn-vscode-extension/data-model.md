# Data Model: ZennPad VS Code拡張

## Entities

### WorkspaceRepo
- Fields: `owner` (string), `repo` (string), `workBranch` (string), `mainBranch` (string), `zennAccount` (string, optional), `isSignedIn` (bool), `authMethod` (browser/PAT), `lastSyncAt` (datetime), `autoSyncPaused` (bool)
- Relationships: 1..N `ZennContentItem`; 1..N `SyncTask`; 1..1 `PreviewSession`
- Validation: branches non-empty; owner/repo required; auth must exist before sync operations.

### ZennContentItem
- Fields: `type` (article/book/chapter/draft/image/file/folder), `path` (string, repo-relative), `slug` (string), `frontmatter` (Frontmatter), `sha` (string, optional), `updatedAt` (datetime), `createdAt` (datetime), `published` (bool), `urlPath` (string for preview/zenn), `children` (for folders/books)
- Relationships: belongs to `WorkspaceRepo`; may have parent/child items (tree).
- Validation: slug unique within type; frontmatter keys valid for type; images stored under `/images`.

### Frontmatter
- Fields: `title` (string), `emoji` (string), `type` (article/book/chapter), `topics` (string[]), `published` (bool), `publishedAt` (datetime, optional), `coverImage` (string, optional), `book`/`chapter` links (for hierarchy)
- Relationships: embedded in `ZennContentItem`.
- Validation: title required; type matches parent folder; topics length bounded; published boolean present.

### SyncTask
- Fields: `id` (uuid), `operation` (pull/push/deploy/flush), `paths` (string[]), `branch` (work/main), `status` (pending/in-progress/succeeded/failed), `retryCount` (int), `error` (string), `scheduledAt` (datetime)
- Relationships: belongs to `WorkspaceRepo`.
- Validation: main branch operations require user confirmation; retry/backoff limited.

### PreviewSession
- Fields: `mirrorPath` (fs path), `backendPort` (int), `proxyPort` (int), `status` (stopped/starting/ready/error), `lastError` (string), `startedAt` (datetime)
- Relationships: belongs to `WorkspaceRepo`.
- Validation: ports must be free; status transitions controlled (stopped→starting→ready | error).

### SearchQuery
- Fields: `keyword` (string), `caseSensitive` (bool), `wholeWord` (bool), `regex` (bool), `results` (SearchResult[])
- Relationships: queries over `ZennContentItem`.
- Validation: regex compilation errors reported; keyword required unless regex provided.

### SearchResult
- Fields: `path` (string), `title` (string), `snippet` (string), `matchType` (filename/title/body), `position` (line/column), `score` (number)
- Relationships: references `ZennContentItem`.

### AuthSession
- Fields: `provider` (GitHub), `tokenType` (browser OAuth/PAT), `expiresAt` (datetime/optional), `scopes` (string[]), `status` (valid/expired/revoked)
- Relationships: tied to `WorkspaceRepo`.
- Validation: scopes must permit Contents+Git Data; stored via SecretStorage.

### CacheEntry
- Fields: `path` (string), `type` (article/book/chapter/draft/image), `frontmatter` (Frontmatter), `sha` (string), `createdAt` (datetime), `updatedAt` (datetime), `cacheVersion` (int), `expiresAt` (datetime)
- Relationships: scoped to `WorkspaceRepo`.
- Validation: discard on version mismatch or expiry.

### ImageAsset
- Fields: `path` (string under /images), `mime` (string), `size` (bytes), `createdAt` (datetime)
- Relationships: subtype of `ZennContentItem`.
- Validation: size ≤ 3MB (warning/skip if over), mime in png/jpg/webp/gif.

## State Transitions (selected)
- SyncTask: pending → in-progress → succeeded | failed (failed may retry with backoff; deploy requires user confirm before in-progress)
- PreviewSession: stopped → starting → ready → stopped | error (error → starting on retry)
- AuthSession: valid → expired/revoked → reauth (sign-in) → valid
- ZennContentItem.published: false → true (Publish command) → false (Unpublish)
