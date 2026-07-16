// Shared types for the catalogue content pipeline. See docs/content-seo/PLAYBOOK.md.

export interface LocaleCopy {
  /** The product title in this locale. Proper nouns are NOT translated. */
  title: string;
  /** 120–160 char meta description → entity_localization.shortDescription. */
  short: string;
  /** 90–160 word body → entity_localization.description. */
  body: string;
}

export interface CuratedProduct {
  /** Real MktProduct.slug — the join key. */
  slug: string;
  en: LocaleCopy;
  es: LocaleCopy;
  /** Optional free note for reviewers; provenance tag is added by the loader. */
  notes?: string;
}
