# Airtable Resources Base - Common Fields Analysis

## Overview
This document analyzes the common fields across all tables in the Resources Base to identify standard fields that should be included when creating new tables. These fields are not content-specific but rather provide consistent structure, tracking, and functionality across all resources.

## Base Information
- **Base Name**: Resources Base
- **Base ID**: `apphmPNiTdmcknmfs`
- **Total Tables**: 15

## Tables Analyzed
1. Series
2. Sessions
3. Articles
4. News
5. Series_2
6. Sessions_2
7. author-speaker
8. Topics
9. Leaders
10. Worship
11. Books
12. Ministry
13. subsplash_resource_lists
14. subsplash_list_rows
15. series_type

## Standard Fields for New Tables

### 1. Core Identification Fields
These fields provide unique identification and basic metadata for each record:

| Field Name | Field Type | Description | Example | WordPress Mapping |
|------------|------------|-------------|---------|-------------------|
| `auto_number` | AutoNumber | Auto-incrementing unique identifier | 1, 2, 3... | N/A |
| `sku` | Formula | Unique SKU code (usually based on auto_number) | "S0001", "R0001", "A0001" | `sku` |
| `id` | Number | WordPress ID or external system ID | 12345 | N/A |
| `title` / `name` | SingleLineText/MultilineText | Primary title/name of the resource | "Series Title" | `post_title` |

### 2. URL and Permalink Fields
These fields handle web routing and SEO:

| Field Name | Field Type | Description | Example | WordPress Mapping |
|------------|------------|-------------|---------|-------------------|
| `slug` | Formula/SingleLineText | URL-friendly version of title | "series-title" | `post_name` |
| `permalink` | URL/Formula | Full URL path | "/resources/series/series-title" | `custom_permalink_uri` |

### 3. Content Management Fields
These fields handle content status and workflow:

| Field Name | Field Type | Description | Example | WordPress Mapping |
|------------|------------|-------------|---------|-------------------|
| `website_status` | SingleSelect | Publication status | "publish", "draft", "private" | `post_status` |
| `excerpt` | MultilineText | Short description/summary | "Brief description..." | `post_excerpt` |
| `content` / `description` | MultilineText | Main content body | "Full content..." | Custom meta |
| `content_admin` | RichText | Admin-only content | "Internal notes..." | Custom meta |

### 4. Timestamp Tracking Fields
These fields provide comprehensive tracking of when content was created, modified, and published:

| Field Name | Field Type | Description | Example | WordPress Mapping |
|------------|------------|-------------|---------|-------------------|
| `last_modified` | LastModifiedTime | When any field was last changed | Auto-generated | N/A |
| `media_last_modified` | LastModifiedTime | When media fields were last changed | Auto-generated | N/A |
| `admin_last_modified` | LastModifiedTime | When admin fields were last changed | Auto-generated | N/A |
| `publish_timestamp` | DateTime | When content was published | 2024-01-15 10:00:00 | `last_published` |
| `media_publish_timestamp` | DateTime | When media was published | 2024-01-15 10:00:00 | N/A |
| `admin_publish_timestamp` | DateTime | When admin content was published | 2024-01-15 10:00:00 | N/A |

### 5. Status and Workflow Fields
These fields provide status indicators and workflow management:

| Field Name | Field Type | Description | Example | WordPress Mapping |
|------------|------------|-------------|---------|-------------------|
| `update_status` | Formula | Human-readable update status | "⚡ Just Updated", "🚀 Updated Today" | N/A |
| `publish_status` | Formula | Publication readiness status | "✅ Ready", "🎯 Needs Publish" | N/A |
| `sync_status` | SingleSelect | External system sync status | "Success", "Processing", "Failed" | N/A |
| `import_status` | SingleLineText | Import process status | "Completed", "Pending" | N/A |

### 6. Media Management Fields
These fields handle images and media assets. **Note: Use the `_wp_id` variant for WordPress sync:**

| Field Name | Field Type | Description | Example | WordPress Mapping |
|------------|------------|-------------|---------|-------------------|
| `featured_image_wp_id` | Number | WordPress media ID (preferred) | 12345 | `_thumbnail_id` |
| `featured_image_link` | URL | Featured image URL (fallback) | "https://example.com/image.jpg" | Custom meta |
| `featured_image_attachment` | MultipleAttachments | Featured image file | Image file | N/A |
| `featured_image_external` | SingleLineText | External image reference | "external_image_id" | N/A |
| `listing_image_wp_id` | Number | WordPress media ID for listing | 12346 | `listing-image` |
| `listing_image_link` | URL | Listing image URL | "https://example.com/listing.jpg" | Custom meta |
| `banner_image_wp_id` | Number | WordPress media ID for banner | 12347 | `banner-image` |
| `banner_image_link` | URL | Banner image URL | "https://example.com/banner.jpg" | Custom meta |
| `no_words_image_wp_id` | Number | WordPress media ID (no text) | 12348 | `no-words-image` |
| `no_words_image_link` | URL | No-text image URL | "https://example.com/nowords.jpg" | Custom meta |

### 7. Category and Classification Fields
These fields provide content organization and navigation:

| Field Name | Field Type | Description | Example | WordPress Mapping |
|------------|------------|-------------|---------|-------------------|
| `category_helper` | SingleLineText | Raw category string | "Resources>Series>Youth" | N/A |
| `category` | SingleLineText | Processed category | "Youth" | Custom taxonomy |
| `category_1`, `category_2`, etc. | Formula | Individual category levels | "Resources", "Series" | N/A |
| `global_categories` | Formula | Full category hierarchy | "Resources > Series > Youth" | `global-categories` |
| `series_category` | SingleSelect | Predefined category options | "Featured Messages" | `series-categories` |

### 8. Relationship Fields
These fields connect content to other resources:

| Field Name | Field Type | Description | Example | WordPress Mapping |
|------------|------------|-------------|---------|-------------------|
| `series` | MultipleRecordLinks | Related series | Links to Series table | `jet_relation_series_parent` |
| `series_sku` | MultipleLookupValues | Series SKU from relationship | "S0001" | `jet_relation_series_parent` |
| `sessions` | MultipleRecordLinks | Related sessions | Links to Sessions table | Custom meta |
| `topics` | MultipleRecordLinks | Related topics | Links to Topics table | `topics` |
| `author` / `speaker` | MultipleRecordLinks | Content creators | Links to author-speaker table | `author-speaker` |

### 9. External Integration Fields
These fields handle connections to external systems:

| Field Name | Field Type | Description | Example | WordPress Mapping |
|------------|------------|-------------|---------|-------------------|
| `wp_id` | Number | WordPress ID | 12345 | N/A |
| `subsplash_*` | Various | Subsplash platform fields | Various Subsplash-specific fields | Custom meta |

### 10. SEO and Metadata Fields
These fields handle search engine optimization:

| Field Name | Field Type | Description | Example | WordPress Mapping |
|------------|------------|-------------|---------|-------------------|
| `seo_description` | Formula/MultilineText | SEO meta description | "SEO description..." | Custom meta |
| `_aioseo_description` | MultilineText | All in One SEO description | "AIOSEO description..." | `_aioseo_description` |
| `aioseo_description` | SingleLineText | Alternative SEO description | "Alternative SEO..." | Custom meta |

### 11. Additional Content Fields
These fields provide extra content and functionality:

| Field Name | Field Type | Description | Example | WordPress Mapping |
|------------|------------|-------------|---------|-------------------|
| `pdf_title_1` | SingleSelect | PDF document title | "Worksheet", "Discussion Pages" | `custom-pdf-title-1` |
| `pdf_link_1` | SingleLineText | PDF document link | "https://example.com/doc.pdf" | `link_ten` |
| `youtube_link` | URL | YouTube video link | "https://youtube.com/watch?v=..." | `link_one` |
| `spotify_podcast` | URL | Spotify podcast link | "https://open.spotify.com/..." | `spotify-podcast-link` |
| `apple_podcast` | URL | Apple Podcasts link | "https://podcasts.apple.com/..." | `apple-podcast-link` |

## Recommended Field Order for New Tables

When creating a new table, consider this field order:

1. **Core Identification** (auto_number, sku, id, title)
2. **Content** (excerpt, content, content_admin)
3. **URLs** (slug, permalink)
4. **Categories** (category_helper, category, global_categories)
5. **Media** (featured_image_wp_id, listing_image_wp_id, banner_image_wp_id, no_words_image_wp_id)
6. **Relationships** (series, sessions, topics, author)
7. **Timestamps** (last_modified, media_last_modified, admin_last_modified)
8. **Publishing** (publish_timestamp, media_publish_timestamp, admin_publish_timestamp, api_publish_timestamp)
9. **Status** (website_status, update_status, publish_status, sync_status)
10. **External IDs** (wp_id, subsplash_*)
11. **SEO** (seo_description, _aioseo_description)
12. **Additional Content** (pdf_*, youtube_link, spotify_podcast, apple_podcast)

## Field Type Recommendations

- Use **Formula** fields for computed values (SKUs, status indicators, derived fields)
- Use **LastModifiedTime** for automatic timestamp tracking
- Use **MultipleAttachments** for file uploads
- Use **MultipleRecordLinks** for relationships to other tables
- Use **SingleSelect** for predefined options (status, categories)
- Use **DateTime** for manual timestamp entry
- Use **URL** for external links
- Use **RichText** for admin content that needs formatting
- Use **Number** for WordPress media IDs and external IDs

## WordPress Integration Notes

### **Media Field Pattern:**
Always create both the `_wp_id` and `_link` variants for media fields:
- `featured_image_wp_id` (Number) → WordPress `_thumbnail_id`
- `featured_image_link` (URL) → Fallback/cache field

### **Taxonomy Mapping:**
- `global_categories` → WordPress `global-categories` taxonomy
- `topics` → WordPress `topics` taxonomy
- `author-speaker` → WordPress `author-speaker` taxonomy

### **Custom Meta Fields:**
- Use descriptive names that match WordPress meta keys
- Consider using the `link_*` pattern for external resources
- Use `custom-*` prefix for custom content fields

## Notes

- **SKU Pattern**: Most tables use a letter prefix + 4-digit number (S0001, R0001, A0001, etc.)
- **Timestamp Consistency**: All tables use the same timestamp field structure for consistency
- **Media Handling**: Standardized approach with wp_id fields for WordPress sync, link fields for fallbacks
- **Category Structure**: Hierarchical category system with helper fields and derived category levels
- **Status Workflow**: Consistent status tracking across all content types
- **WordPress Sync**: Fields are designed to map directly to WordPress post types and taxonomies

This analysis provides a foundation for maintaining consistency when creating new tables in the Resources Base while ensuring all necessary functionality is preserved and proper WordPress integration is maintained.
