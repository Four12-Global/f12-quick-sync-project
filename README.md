Four12 Quick Sync — WordPress Plugin (quick-sync-plugin)

A modular REST layer that receives clean payloads from Airtable (or any upstream) and writes to WordPress posts, taxonomies, media, and JetEngine relationships — safely and idempotently.

⸻

### What this plugin does (in plain English)
*	Registers REST endpoints under `four12/v1/*` (one per content module).
*	Authenticates via WordPress Application Passwords (service account recommended).
*	Resolves target records by `wp_id` → `sku` → `slug` (sane, predictable).
*	Transforms on the server only (markdown → HTML, media sideloading, AIOSEO, custom permalinks).
*	Writes content to WP post fields, meta, taxonomies, and JetEngine relationships.
*	Stays safe by default: nothing is deleted unless you explicitly send `null`.

**TL;DR**: You send a small, declarative JSON payload. The plugin does the heavy lifting and keeps your site tidy.

⸻

### Requirements & optional integrations
*	WordPress with a user that can `edit_posts` (service user recommended).
*	Application Passwords (WordPress core) for auth.
*	**Optional but supported**
*	Parsedown (`vendor/parsedown/Parsedown.php`) — markdown → HTML. If not present, markdown features are skipped.
*	Permalink Manager — supports `custom_permalink_uri` for deterministic URLs.
*	JetEngine (Relations) — used to link child/parent content (e.g., Session → Series).
*	All in One SEO (AIOSEO) — first-class handling for `_aioseo_description`.

⸻

### Install
1.	Copy the `quick-sync-plugin` folder into `wp-content/plugins/`.
2.	Activate **Four12 – Quick Sync Framework** in Plugins.
3.	(Optional) Drop Parsedown into `quick-sync-plugin/vendor/parsedown/Parsedown.php`.
4.	(Optional) Ensure Permalink Manager and/or JetEngine are active if you use those features.

⸻

### Authentication

Use a dedicated service user + Application Password:

```bash
# Sanity check your creds
curl -u "sync-bot:APPLICATION-PASSWORD" https://example.com/wp-json/

# Example POST (Series)
curl -u "sync-bot:APPLICATION-PASSWORD" \
     -H "Content-Type: application/json" \
     -X POST https://example.com/wp-json/four12/v1/series-sync \
     -d '{"sku":"SER-001","fields":{"post_title":"My Series"}}'
```

**Permission check**: the plugin requires `current_user_can('edit_posts')`. If you get `403`, check the user role.

⸻

### Shared request shape (CPT endpoints)

All post-based modules accept:

```json
{
  "sku": "YOUR-STABLE-ID",                  // required
  "fields": { /* payload keys (see modules) */ },  // required
  "wp_id": 123,                             // optional, fast-path update
  "airtableRecordId": "recXXXX"             // optional, for logging
}
```

*	**Identity resolution**: `wp_id` → `sku` → `slug` (from `fields.post_name`), first match wins.
*	**Deletes**: set a key to `null` to delete it. Omitted keys are ignored (no change).
*	**Post status**: allowed values = `publish`, `draft`, `private`, `trash`.

**Special fields** handled by the base class:
*	`post_title`, `post_name` (slug), `post_excerpt`, `post_date`, `post_status`
*	`custom_permalink_uri` (if Permalink Manager is active)
*	`_thumbnail_id` (ID or URL — URL triggers sideload)
*	`_aioseo_description` (native AIOSEO write if available; meta fallback)

**Markdown mapping** (when Parsedown is present):
*	Modules can declare which incoming keys are markdown and where to save the rendered HTML (e.g., `post_content`, or a meta field).

⸻

### Endpoints (modules) at a glance

#### 1) Series — `POST /wp-json/four12/v1/series-sync`
*	**CPT**: `series`
*	**Core fields**: `post_title`, `post_name`, `post_excerpt`, `post_date`, `post_status`, `custom_permalink_uri`
*	**Taxonomies**:
	*	`global-categories` → `global-categories`
	*	`series-categories` → `series-categories`
	*	`topics` → `topics`
	*	`series-templates` → `series-templates`
*	**Media meta** (ID or URL): `_thumbnail_id`, `listing-image`, `no-words-image`, `banner-image`, `manual1-image`
*	**Markdown**: `series_description` → writes to both `post_content` and `series_description` (meta)

**Example payload**

```json
{
  "sku": "SER-001",
  "fields": {
    "post_title": "Ephesians Series",
    "post_name": "ephesians-series",
    "post_status": "publish",
    "post_date": "2024-06-01",
    "custom_permalink_uri": "resources/series/ephesians-series",
    "series_description": "# Welcome\n**Strong** foundations.",
    "global-categories": ["Worship > Songs", "Teaching"],
    "_thumbnail_id": "https://cdn.example.com/imgs/series-cover.jpg",
    "_aioseo_description": "A Bible teaching series on Ephesians."
  }
}
```

⸻

#### 2) Sessions — `POST /wp-json/four12/v1/sessions-sync`
*	**CPT**: `resources`  ← (Yes, sessions live in the `resources` post type)
*	**Core fields**: `post_title`, `post_name`, `post_excerpt`, `post_date`, `post_status`
*	**Taxonomies**: `global-categories`, `series-categories`, `topics`, `series-templates`, `author-speaker` → `author_speaker`
*	**Media meta**: `_thumbnail_id`, `listing-image`, `no-words-image`, `banner-image`, `manual1-image`
*	**Markdown**: `session_description_admin` → `post_content`
*	**JetEngine relation** (Session → Series parent):
	*	Payload key: `jet_relation_series_parent`
	*	Value: a Series SKU (string) or an array of SKUs
	*	Empty or `null` disconnects all parents
	*	Relation config: `relation_id: 63`, parent CPT `series`, parent SKU meta `sku`

**Example payload**

```json
{
  "sku": "SES-1001",
  "wp_id": 0,
  "fields": {
    "post_title": "Ephesians 1: Our Calling",
    "post_name": "ephesians-1-our-calling",
    "post_status": "publish",
    "post_date": "2024-06-07T09:30:00Z",
    "author-speaker": ["Andrew Selley"],
    "topics": "Identity, Grace",
    "_thumbnail_id": "https://cdn.example.com/sessions/ep1.jpg",
    "session_description_admin": "## Notes\n- Chosen\n- Adopted",
    "jet_relation_series_parent": "SER-001"
  }
}
```

⸻

#### 3) Worship — `POST /wp-json/four12/v1/worship-sync`
*	**CPT**: `songs`
*	**Core fields**: `post_title`, `post_name`, `post_excerpt`, `post_date`, `post_status`
*	**Taxonomies**:
	*	`worship_artist` → `worship-artist`
	*	`topics` → `topics`
	*	`global-categories` → `global-categories`
*	**Media meta**: `_thumbnail_id`, `chord_sheet_pdf` (URLs are sideloaded; attachment ID is stored)
*	**Other handy meta**: `apple_music_link`, `spotify_link`, `youtube_music_link` (saved as plain meta)
*	**Markdown**: none by default

**Example payload**

```json
{
  "sku": "W0036",
  "fields": {
    "post_title": "O You Are Beautiful",
    "post_name": "o-you-are-beautiful",
    "post_status": "publish",
    "post_date": "2018-03-30",
    "worship_artist": ["Mervis"],
    "topics": "Chords, Lyrics",
    "_thumbnail_id": "https://cdn.example.com/covers/o-you-are-beautiful.jpg",
    "chord_sheet_pdf": "https://cdn.example.com/chords/o-you-are-beautiful.pdf",
    "apple_music_link": "https://music.apple.com/za/album/...",
    "_aioseo_description": "A worship song by Mervis with chords and lyrics."
  }
}
```

⸻

#### 4) Leaders — `POST /wp-json/four12/v1/leader-sync`
*	**CPT**: `f12-leaders`
*	**Core fields**: `post_title`, `post_excerpt`
*	**Taxonomies**: `leadership-role` → `leadership-role`
*	**Media meta**: `_thumbnail_id`
*	**Markdown** (module-specific):
	*	If you pass `leader_description` (markdown) in `fields`, the module converts it to HTML and stores it in the `leader_description` meta.
	*	The raw key is then removed from the payload to avoid double-processing.

**Example payload**

```json
{
  "sku": "LEAD-042",
  "fields": {
    "post_title": "Jane Doe",
    "post_excerpt": "Elder, teacher, equipper.",
    "leadership-role": ["Elders"],
    "_thumbnail_id": "https://cdn.example.com/people/jane_doe.jpg",
    "leader_description": "### About Jane\nWalking with Jesus since 2009."
  }
}
```

⸻

#### 5) Author/Speaker Taxonomy — `POST /wp-json/four12/v1/author-sync`
*	**Taxonomy**: `author_speaker`
*	**Request shape**:

```json
{
  "sku": "AUTH-001",
  "fields": {
    "name": "Andrew Selley",
    "slug": "andrew-selley",
    "as_description": "Bio in **markdown** or HTML",
    "status": "active",
    "profile_image": "https://cdn.example.com/author/andrew.png"
  },
  "wp_id": 0
}
```

*	**Required field**: `fields.name`
*	**Identity resolution**: `wp_id` → `sku` → `slug`
*	**Description handling**: prefer `as_description`; if Present + Parsedown available → convert markdown → term meta `as_description` (safe HTML). Otherwise stores text/HTML as given.
*	**Meta whitelist** (only these are written): `profile_image`, `status`
(Unknown keys are ignored and reported via logs; send `null` to delete a whitelisted key.)

⸻

### Behavior details that matter
*	**Idempotency**: same payload → safe no-op; nothing magically disappears.
*	**Deletion semantics**: set a key to `null` to remove it:
	*	Meta: `{ "fields": { "custom_key": null } }` deletes that meta.
	*	Taxonomy: `""` or `null` clears terms for that taxonomy key.
	*	Featured image: `_thumbnail_id: null` removes thumbnail.
*	**Dates & timezone**: send ISO 8601 (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss[Z]`). The plugin converts to site timezone and sets both `post_date` and `post_date_gmt` correctly (DST-safe).
*	**Permalinks**: if `custom_permalink_uri` is present and Permalink Manager is active, that URI is saved and `post_name` is not changed. Without Permalink Manager, use `post_name`.
*	**AIOSEO**: if `_aioseo_description` is present and AIOSEO is active, it’s saved via the AIOSEO model; otherwise stored as post meta.

⸻

### Common errors & fixes
*	**400 – bad JSON / missing fields**
Ensure `Content-Type: application/json`. Include `sku` and `fields` (and `fields.name` for `author-sync`).
*	**403 – forbidden**
The service user lacks `edit_posts` or the Application Password is wrong.
*	**409 – conflict (wrong CPT)**
A `wp_id` points to a post of the wrong type for that endpoint. Fix the target or send the correct endpoint.
*	**Media sideload failed**
Check the URL is reachable and returns a valid `Content-Type`. PDFs/images are accepted via WordPress’ `media_handle_sideload`.
*	**JetEngine not active**
Relationship payload keys are ignored if JetEngine/relations are unavailable. Activate JetEngine or remove the keys.

**Pro tip**: enable `WP_DEBUG_LOG` in `wp-config.php`. The plugin logs under the prefix `[Four12 Quick Sync]`.

⸻

### Testing snippets (swap endpoint accordingly)

```bash
# Create/update a Series
curl -u "sync-bot:APP-PASS" -H "Content-Type: application/json" \
  -X POST https://example.com/wp-json/four12/v1/series-sync \
  -d '{"sku":"SER-TEST-1","fields":{"post_title":"Hello Series","post_status":"draft"}}'

# Link a Session to its Series (JetEngine)
curl -u "sync-bot:APP-PASS" -H "Content-Type: application/json" \
  -X POST https://example.com/wp-json/four12/v1/sessions-sync \
  -d '{"sku":"SES-TEST-1","fields":{"post_title":"Session 1","jet_relation_series_parent":"SER-TEST-1"}}'

# Create/update an Author/Speaker term
curl -u "sync-bot:APP-PASS" -H "Content-Type: application/json" \
  -X POST https://example.com/wp-json/four12/v1/author-sync \
  -d '{"sku":"AUTH-TEST","fields":{"name":"John Example","status":"active"}}'
```

⸻

### Changelog (keep this short & useful)
*	**2.1.0** — Safer `wp_id` validation, explicit `409` for wrong CPT; AIOSEO integration; JetEngine relation helper; custom permalink support; markdown maps; media sideloading improvements; taxonomy normalization.
*	**2.0.0** — Initial modularization of Series, Sessions, Worship, Leaders; SKU-first idempotency.

⸻

### Maintainers
*	Four12 Global — ops/content
*	Engineering — you (and Future You). Leave breadcrumbs.

⸻

If you only remember one rule: **never ship to prod before you’ve run the payload against staging and eyeballed the result.** Your future self will thank you.