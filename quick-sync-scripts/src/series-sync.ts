import { quickSync } from './lib/sync-helpers';

const FIELD_MAP = {
  /* ── Core WP fields ───────────────────────────── */
  series_title:      'post_title',
  slug:              'post_name',
  long_date:         'post_date',
  website_status:    'post_status',
  series_sku:        'sku',
  excerpt:           'post_excerpt',

  /* Custom permalink (Permalink Manager) */
  series_permalink:  'custom_permalink_uri',

  /* ── Taxonomies ──────────────────────────────── */
  global_categories:      'global-categories',
  series_filter_category: 'series-categories',
  topics:                 'topics',
  series_template:        'series-templates',

  /* ── ACTIVE media (prefer ID, fallback URL) ──── */
  featured_image: {
    airtableIdField:   'featured_image_wp_id',
    airtableLinkField: 'featured_image_link',
    wpKey: '_thumbnail_id',
  },
  listing_image: {
    airtableIdField:   'listing_image_wp_id',
    airtableLinkField: 'listing_image_link',
    wpKey: 'listing-image',
  },
  no_words_image: {
    airtableIdField:   'no_words_image_wp_id',
    airtableLinkField: 'no_words_image_link',
    wpKey: 'no-words-image',
  },
  banner_image: {
    airtableIdField:   'banner_image_wp_id',
    airtableLinkField: 'banner_image_link',
    wpKey: 'banner-image',
  },
  primary_cta_image: {
    airtableIdField:   'primary_cta_image_wp_id',
    airtableLinkField: 'primary_cta_image_link',
    wpKey: 'manual1-image',
  },

  /* ── Meta / CTA / SEO etc. ───────────────────── */
  series_description_title: 'series-description_title',
  series_description:       'series-description',
  who_is_it_for:            'series-who-is-it-for',
  series_purpose:           'series-purpose',
  series_colour_1:          'series-colour-1',
  series_colour_2:          'series-colour-2',
  print_pdf_link:           'link_five',
  custom_pdf_link:          'link_ten',
  youtube_playlist:         'youtube-playlist-link',
  spotify_playlist:         'spotify-playlist-link',
  apple_playlist:           'apple-playlist-link',
  highlights_video:         'highlights-video',

  /* CTA blocks */
  primary_cta_heading: 'manual1-title',
  primary_cta_title:   'manual1-link-title',
  primary_cta_link:    'manual1-link',
  secondary_cta_heading: 'manual2-title',
  secondary_cta_title:   'manual2-link-title',
  secondary_cta_link:    'manual2-link',

  seo_description:     '_aioseo_description',
  session_title:       'custom-session-title',
  sessions_list:       'series-episode-list',
  session_list_1:      'series-episode-list-more',
  session_list_2:      'series-episode-list-3',
  session_list_3:      'series-episode-list-4',
};

// The single, valid call to input.config() for the entire script run.
const scriptInput = input.config();

quickSync({
  /* ----- Airtable table name ----- */
  airtableTable: 'Series',

  /* ----- Airtable field that holds your permanent SKU & title ----- */
  skuField:   'series_sku',
  titleField: 'series_title',

  /* ----- END per‑CPT overrides ----- */
  fieldMap: FIELD_MAP,
  envEndpoints: {
    prod:     'https://four12global.com/wp-json/four12/v1/series-sync',
    staging:  'https://wordpress-1204105-5660147.cloudwaysapps.com/wp-json/four12/v1/series-sync',
  }
}, scriptInput);