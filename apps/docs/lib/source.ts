import { docs } from 'collections/server';
import { loader } from 'fumadocs-core/source';

/**
 * Planning catalogs keep children registered in meta.json
 * for check:planning, but the sidebar should only show the index entry — open the
 * index page to browse items with DocKind tickers.
 */
const INDEX_ONLY_FOLDER_URLS = new Set([
  '/docs/planning/prds',
  '/docs/planning/stories',
  '/docs/development/plans',
  '/docs/development/adr',
  '/docs/spec/cli',
]);

function normalizeUrl(url: string) {
  return url.length > 1 && url.endsWith('/') ? url.slice(0, -1) : url;
}

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  pageTree: {
    transformers: [
      {
        folder(node) {
          const indexUrl = node.index?.url ? normalizeUrl(node.index.url) : null;
          if (indexUrl && INDEX_ONLY_FOLDER_URLS.has(indexUrl)) {
            return { ...node, children: [], defaultOpen: false };
          }
          return node;
        },
      },
    ],
  },
});

/** Prev/next footer cards among ADR siblings (hidden from the sidebar tree). */
export function adrFooterItems(slug: string[] | undefined):
  | {
      previous?: { name: string; description?: string; url: string };
      next?: { name: string; description?: string; url: string };
    }
  | undefined {
  if (!slug || slug[0] !== 'development' || slug[1] !== 'adr' || slug.length !== 3) {
    return undefined;
  }

  const siblings = source
    .getPages()
    .filter(
      (page) =>
        page.slugs[0] === 'development' &&
        page.slugs[1] === 'adr' &&
        page.slugs.length === 3,
    )
    .sort((a, b) =>
      (a.slugs[2] ?? '').localeCompare(b.slugs[2] ?? '', undefined, { numeric: true }),
    );

  const index = siblings.findIndex((page) => page.slugs[2] === slug[2]);
  if (index === -1) return undefined;

  const toItem = (page: (typeof siblings)[number]) => ({
    name: page.data.title,
    description:
      typeof page.data.description === 'string' ? page.data.description : undefined,
    url: page.url,
  });

  const previous = index > 0 ? toItem(siblings[index - 1]!) : undefined;
  const next = index < siblings.length - 1 ? toItem(siblings[index + 1]!) : undefined;
  if (!previous && !next) return undefined;
  return {
    ...(previous ? { previous } : {}),
    ...(next ? { next } : {}),
  };
}
