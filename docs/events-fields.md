# Events Field Mapping

Single source of truth for mapping **Airtable → WordPress** for the **`events`** CPT in the **F12 Quick Sync** project. This matches the current WP All Import template exactly where that template provides a mapping. Any gaps are explicitly called out as **Not mapped in template** so nothing here silently contradicts the source.

* **CPT slug:** `events`
* **Taxonomies in use:** `event-type` (multi), `locations` (single), `global-categories` (single), `topics` (multi)
* **Taxonomy present but not mapped in template:** `country-flags` (see gaps)
* **Duplicate indicator in WP All Import:** custom field `sku` ← `{event_sku}`
* **Images:** Featured & Banner & Gallery import **by URL** (search in Media Library by URL); gallery writes IDs to `gallery_image_ids`.
* **Permalink Manager:** “update custom URI” **enabled** in the template but **no XPath/source set** (see gaps).
* **Incremental sync pivot:** `{publish_timestamp}` → `event_last_published`

> Legend (WP Type): **Post field** = native post property; **Taxonomy** = term assign; **JetEngine meta** = meta saved to the given key; **Custom field** = meta but not defined in JetEngine; **—** = not mapped in the current template (ignored).

---

## Airtable → WordPress mapping table

| Airtable field                   | WordPress label (UI)       | WP key / target                   | WP type                         | Notes                                                                          |
| -------------------------------- | -------------------------- | --------------------------------- | ------------------------------- | ------------------------------------------------------------------------------ |
| `title`                          | Title                      | `post_title`                      | Post field                      | Mapped.                                                                        |
| `id`                             | Source Record ID           | —                                 | —                               | Used by importer internally; not saved.                                        |
| `event_sku`                      | Event SKU                  | `sku`                             | JetEngine meta (text)           | Also used as **duplicate indicator**.                                          |
| `event_short_name`               | Event Short Name           | `event_short_name`                | JetEngine meta (text)           | Mapped.                                                                        |
| `excerpt`                        | Excerpt                    | `post_excerpt`                    | Post field                      | Mapped.                                                                        |
| `permalink`                      | Custom Permalink           | —                                 | —                               | **Not mapped in template**. (Permalink Manager update is on but empty source.) |
| `publish_date`                   | Publish Date               | `post_date`                       | Post field (date)               | Mapped.                                                                        |
| `featured_image_id`              | —                          | `_thumbnail_id`                   | —                               | **Not mapped**. (Importer resolves via URL instead.)                           |
| `featured_image_url`             | Featured image             | (Featured image)                  | Featured image                  | **By URL** (single).                                                           |
| `banner_image_id`                | —                          | `banner_image`                    | —                               | **Not mapped**. (URL path is used.)                                            |
| `banner_image_url`               | Banner Image               | `banner_image`                    | JetEngine meta (media)          | **By URL** (search by URL).                                                    |
| `event_type`                     | Event Type                 | `event-type`                      | Taxonomy (multiple)             | Comma‑separated terms.                                                         |
| `category`                       | Global Categories          | `global-categories`               | Taxonomy (single)               | Single term.                                                                   |
| `topics`                         | Topics                     | `topics`                          | Taxonomy (multiple)             | Comma‑separated terms.                                                         |
| `aioseo_description`             | AIOSEO Description         | `_aioseo_description`             | Custom field                    | Mapped.                                                                        |
| `start_date`                     | Start Date                 | `date_start`                      | JetEngine meta (datetime-local) | Expected local datetime string.                                                |
| `end_date`                       | End Date                   | `date_end`                        | JetEngine meta (date)           | Date only.                                                                     |
| `long_date`                      | Dates and Year             | `dates-and-year`                  | JetEngine meta (text)           | Human‑readable.                                                                |
| `short_date`                     | Short Date                 | `short_date`                      | JetEngine meta (text)           | Human‑readable short.                                                          |
| `venue_location`                 | Location                   | `event-location`                  | JetEngine meta (text)           | Free text venue/city line.                                                     |
| `country`                        | Locations                  | `locations`                       | Taxonomy (single)               | Mapped to locations **only** in template.                                      |
| `cta_title`                      | Call to Action Text        | `call_to_action_text`             | JetEngine meta (text)           | Mapped.                                                                        |
| `cta_link`                       | Call to Action Link        | `call_to_action_link`             | JetEngine meta (text)           | Mapped.                                                                        |
| `google_map_pin`                 | Google Map Pin             | `event_google_map_pin`            | JetEngine meta (text)           | Mapped.                                                                        |
| `contact_person`                 | Contact Person             | `event-contact-person-name`       | JetEngine meta (text)           | Mapped.                                                                        |
| `contact_email`                  | Contact Email              | `event-contact-email`             | JetEngine meta (text)           | Mapped.                                                                        |
| `contact_number`                 | Contact Phone Number       | `event-contact-person-name_phone` | JetEngine meta (text)           | Mapped (note the key name includes `_name_phone`).                             |
| `venue_address`                  | Full Address               | `event_address`                   | JetEngine meta (textarea)       | Mapped.                                                                        |
| `venue_address_admin`            | Admin Address              | —                                 | —                               | **Not mapped**.                                                                |
| `video_link`                     | Video Link                 | `video_link`                      | JetEngine meta (text)           | Mapped.                                                                        |
| `leaders_time_register_link`     | Leaders Time Register Link | `leaders_time_register_link`      | JetEngine meta (text)           | Mapped.                                                                        |
| `button_title`                   | Extra Button Text          | `extra_button_text`               | JetEngine meta (text)           | Mapped.                                                                        |
| `button_link`                    | Extra Button Link          | `extra_button_link`               | JetEngine meta (text)           | Mapped.                                                                        |
| `invitation`                     | Invitation                 | `invitation`                      | JetEngine meta (select)         | Values must match JetEngine options.                                           |
| `about_event`                    | About Event                | `about_event`                     | JetEngine meta (wysiwyg)        | Mapped (HTML expected).                                                        |
| `attend_event`                   | Attend Event               | `attend_event`                    | JetEngine meta (wysiwyg)        | Mapped (HTML expected).                                                        |
| `gallery_image_ids`              | Gallery Images (IDs)       | `gallery_image_ids`               | —                               | **Not used as input**; importer fills IDs from URLs.                           |
| `gallery_image_url`              | Gallery Images (URLs)      | `gallery_image_ids`               | JetEngine meta (gallery)        | **By URL** (comma‑separated); importer resolves to IDs.                        |
| `schedule_leaders_elders_select` | Leaders or Elders Time     | `schedule_leaders_elders_select`  | JetEngine meta (select)         | Mapped.                                                                        |
| `schedule_title_day_1`           | Leaders Day Date           | `schedule_title_day_1`            | JetEngine meta (text)           | Mapped.                                                                        |
| `schedule_details_day_1`         | Leaders Day Schedule       | `schedule_details_day_1`          | JetEngine meta (wysiwyg)        | Mapped.                                                                        |
| `schedule_title_day_2`           | Day 1 Date                 | `schedule_title_day_2`            | JetEngine meta (text)           | Mapped.                                                                        |
| `schedule_details_day_2`         | Day 1 Schedule             | `schedule_details_day_2`          | JetEngine meta (wysiwyg)        | Mapped.                                                                        |
| `schedule_title_day_3`           | Day 2 Date                 | `schedule_title_day_3`            | JetEngine meta (text)           | Mapped.                                                                        |
| `schedule_details_day_3`         | Day 2 Schedule             | `schedule_details_day_3`          | JetEngine meta (wysiwyg)        | Mapped.                                                                        |
| `schedule_title_day_4`           | Day 3 Date                 | `schedule_title_day_4`            | JetEngine meta (text)           | Mapped.                                                                        |
| `schedule_details_day_4`         | Day 3 Schedule             | `schedule_details_day_4`          | JetEngine meta (wysiwyg)        | Mapped.                                                                        |
| `info_blocks`                     | Info Blocks                | `info_blocks`                     | JetEngine meta (text)           | Mapped.                                                                        |
| `info_title_1`                   | Info Title 1               | `info_title_1`                    | JetEngine meta (text)           | Mapped.                                                                        |
| `info_description_1`             | Info Description 1         | `info_description_1`              | JetEngine meta (wysiwyg)        | Mapped.                                                                        |
| `info_title_2`                   | Info Title 2               | `info_title_2`                    | JetEngine meta (text)           | Mapped.                                                                        |
| `info_description_2`             | Info Description 2         | `info_description_2`              | JetEngine meta (wysiwyg)        | Mapped.                                                                        |
| `info_title_3`                   | Info Title 3               | `info_title_3`                    | JetEngine meta (text)           | Mapped.                                                                        |
| `info_description_3`             | Info Description 3         | `info_description_3`              | JetEngine meta (wysiwyg)        | Mapped.                                                                        |
| `info_title_4`                   | Info Title 4               | `info_title_4`                    | JetEngine meta (text)           | Mapped.                                                                        |
| `info_description_4`             | Info Description 4         | `info_description_4`              | JetEngine meta (wysiwyg)        | Mapped.                                                                        |
| `info_title_5`                   | Info Title 5               | `info_title_5`                    | JetEngine meta (text)           | Mapped.                                                                        |
| `info_description_5`             | Info Description 5         | `info_description_5`              | JetEngine meta (wysiwyg)        | Mapped.                                                                        |
| `info_title_6`                   | Info Title 6               | `info_title_6`                    | JetEngine meta (text)           | Mapped.                                                                        |
| `info_description_6`             | Info Description 6         | `info_description_6`              | JetEngine meta (wysiwyg)        | Mapped.                                                                        |
| `info_title_7`                   | Info Title 7               | `info_title_7`                    | JetEngine meta (text)           | Mapped.                                                                        |
| `info_description_7`             | Info Description 7         | `info_description_7`              | JetEngine meta (wysiwyg)        | Mapped.                                                                        |
| `info_icon_1`                    | Info Icon 1                | `info_icon_1`                     | JetEngine meta (textarea)       | Mapped.                                                                        |
| `info_icon_2`                    | Info Icon 2                | `info_icon_2`                     | JetEngine meta (textarea)       | Mapped.                                                                        |
| `info_icon_3`                    | Info Icon 3                | `info_icon_3`                     | JetEngine meta (textarea)       | Mapped.                                                                        |
| `info_icon_4`                    | Info Icon 4                | `info_icon_4`                     | JetEngine meta (textarea)       | Mapped.                                                                        |
| `info_icon_5`                    | Info Icon 5                | `info_icon_5`                     | JetEngine meta (textarea)       | Mapped.                                                                        |
| `info_icon_6`                    | Info Icon 6                | `info_icon_6`                     | JetEngine meta (textarea)       | Mapped.                                                                        |
| `info_icon_7`                    | Info Icon 7                | `info_icon_7`                     | JetEngine meta (textarea)       | Mapped.                                                                        |
| `last_modified`                  | —                          | —                                 | —                               | Not mapped (Airtable-only).                                                    |
| `admin_last_modified`            | —                          | —                                 | —                               | Not mapped (Airtable-only).                                                    |
| `admin_last_publish`             | —                          | —                                 | —                               | Not mapped (Airtable-only).                                                    |
| `media_last_modified`            | —                          | —                                 | —                               | Not mapped (Airtable-only).                                                    |
| `website_status`                 | Post Status                | `post_status`                     | Post field                      | Mapped.                                                                        |
| `approval_helper`                | —                          | —                                 | —                               | Not mapped (Airtable-only).                                                    |
| `publish_status`                 | —                          | —                                 | —                               | Not mapped (Airtable-only).                                                    |
| `update_status`                  | —                          | —                                 | —                               | Not mapped (Airtable-only).                                                    |
| `publish_timestamp`              | Event Last Published       | `event_last_published`            | JetEngine meta (text)           | Mapped (also used by sync).                                                    |

---

## Required for publish

* `title`
* `event_sku`
* `website_status` (e.g., `publish` or `draft`)
* `publish_date`
* `start_date`, `end_date` (or a valid `short_date`/`long_date` combo for display)
* At least one of: `featured_image_url` or `banner_image_url` (site design uses imagery heavily)

> Enforce at Airtable level where possible. The importer will otherwise create thin posts that fail frontend expectations.

---

## Importer settings to keep

* **Duplicate indicator:** Custom field `sku`.
* **Search images in media:** **By URL** (enabled).
* **Gallery input:** comma‑separated URLs → store to `gallery_image_ids`.
* **Permalink Manager:** “Update custom URI” enabled, **but no source field set** (currently does nothing).

---

## Gaps / TODOs (not mapped in template)

* **`permalink`** → (Permalink Manager Custom URI). Either:

  * Add mapping in WP All Import so `{permalink}` sets the Custom URI, **or**
  * Keep handling in your Quick Sync plugin (`save_single_uri`), and leave template empty.
* **`country-flags` taxonomy**: currently **not mapped**. If you want flags, map `{country}` here as well.
* Optional admin-only fields not mapped: `venue_address_admin`, the various `*_modified` / `*_status` helpers.

---

## Example payload shape (JSON → importer fields)

```json
{
  "title": "Ephesians 4 Training – Cape Town",
  "event_sku": "E0023",
  "excerpt": "Two days of equipping for leaders and saints.",
  "publish_date": "2025-11-01",
  "website_status": "publish",
  "featured_image_url": "https://example.com/hero.jpg",
  "banner_image_url": "https://example.com/banner.jpg",
  "gallery_image_url": "https://example.com/g1.jpg,https://example.com/g2.jpg",
  "event_type": "Training,Leaders",
  "category": "Events",
  "topics": "Equipping,Leadership",
  "country": "South Africa",
  "start_date": "2025-11-03T09:00",
  "end_date": "2025-11-04",
  "long_date": "3–4 Nov 2025",
  "short_date": "3–4 Nov",
  "venue_location": "Cape Town",
  "event_short_name": "E4 Cape Town",
  "cta_title": "Register",
  "cta_link": "https://example.com/register",
  "google_map_pin": "-33.9249,18.4241",
  "contact_person": "Jane Doe",
  "contact_email": "jane@example.com",
  "contact_number": "+27 82 000 0000",
  "venue_address": "123 Church Rd, Cape Town, South Africa",
  "video_link": "https://youtu.be/abc123",
  "leaders_time_register_link": "https://example.com/leaders-time",
  "button_title": "Schedule",
  "button_link": "https://example.com/schedule.pdf",
  "invitation": "Open",
  "about_event": "<p>Bring your Bible and a teachable heart.</p>",
  "attend_event": "<p>Please register by 28 Oct.</p>",
  "schedule_leaders_elders_select": "Leaders",
  "schedule_title_day_1": "Leaders Day – Mon",
  "schedule_details_day_1": "<p>09:00–12:00 Sessions</p>",
  "schedule_title_day_2": "Day 1 – Tue",
  "schedule_details_day_2": "<p>09:00–16:00 Equip</p>",
  "info_blocks": "Enabled",
  "info_title_1": "Kids",
  "info_description_1": "<p>No child care provided.</p>",
  "publish_timestamp": "2025-08-15T10:00:00+02:00"
}
```

---

## Changelog

* **2025‑08‑15:** Initial version aligned to WP All Import template `templates_689f05b00cc41.txt`. Added explicit “Not mapped in template” flags for clarity.
