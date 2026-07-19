import { InlineTOC } from 'fumadocs-ui/components/inline-toc';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DocKind, docKindFromSlug } from '@/components/blocks/doc-kind';
import { getMDXComponents } from '@/components/mdx';
import { source } from '@/lib/source';

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const kind = docKindFromSlug(params.slug);
  const ticker = typeof page.data.ticker === 'string' ? page.data.ticker : undefined;
  const toc = page.data.toc;

  return (
    <DocsPage toc={toc} full={page.data.full}>
      <DocsTitle>
        <span className="inline-flex flex-wrap items-center gap-2">
          {kind ? <DocKind kind={kind} ticker={ticker} /> : null}
          {page.data.title}
        </span>
      </DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      {toc.length > 0 ? <InlineTOC items={toc}>목차</InlineTOC> : null}
      <DocsBody>
        <MDX components={getMDXComponents({ a: createRelativeLink(source, page) })} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return { title: page.data.title, description: page.data.description };
}
