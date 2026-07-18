'use client';

import type { ReactNode } from 'react';
import type * as PageTree from 'fumadocs-core/page-tree';
import Link from 'fumadocs-core/link';
import { usePathname } from 'fumadocs-core/framework';
import { useTreePath } from 'fumadocs-ui/contexts/tree';
import {
  SidebarFolder,
  useFolder,
  useFolderDepth,
} from 'fumadocs-ui/components/sidebar/base';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/cn';

/**
 * Fumadocs folder accordion that does not use Radix CollapsibleContent.
 *
 * CollapsibleContent relies on CSS height animation + Presence animationend.
 * In Cursor's browser preview (and some embeds) that event never fires, so
 * aria-expanded / chevron flip but children stay visible. Render children
 * only when open instead.
 */

const itemClass =
  'relative flex flex-row items-center gap-2 rounded-lg p-2 text-start text-fd-muted-foreground wrap-anywhere [&_svg]:size-4 [&_svg]:shrink-0 transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80 hover:transition-none data-[active=true]:bg-fd-primary/10 data-[active=true]:text-fd-primary data-[active=true]:hover:transition-colors w-full';

function getItemOffset(depth: number) {
  return `calc(${2 + 3 * depth} * var(--spacing))`;
}

function normalize(url: string) {
  return url.length > 1 && url.endsWith('/') ? url.slice(0, -1) : url;
}

function isActivePath(href: string, pathname: string) {
  return normalize(href) === normalize(pathname);
}

function useFolderState() {
  const folder = useFolder();
  if (!folder) {
    throw new Error('DocsSidebarFolder components must render inside SidebarFolder');
  }
  return folder;
}

function InstantFolderContent({ children }: { children: ReactNode }) {
  const { open } = useFolderState();
  const depth = useFolderDepth();

  if (!open) return null;

  return (
    <div
      className={cn(
        'relative flex flex-col gap-0.5 pt-0.5',
        depth === 1 &&
          "before:content-[''] before:absolute before:w-px before:inset-y-1 before:bg-fd-border before:inset-s-2.5",
      )}
    >
      {children}
    </div>
  );
}

function FolderLink({
  href,
  active,
  external,
  children,
}: {
  href: string;
  active: boolean;
  external?: boolean;
  children: ReactNode;
}) {
  const { open, setOpen, collapsible } = useFolderState();
  const depth = useFolderDepth();

  return (
    <div
      className={cn(itemClass, active && 'bg-fd-primary/10 text-fd-primary')}
      style={{ paddingInlineStart: getItemOffset(depth - 1) }}
      data-active={active}
    >
      <Link
        href={href}
        external={external}
        className="flex min-w-0 flex-1 items-center gap-2"
        onClick={() => {
          if (collapsible && !open) setOpen(true);
        }}
      >
        {children}
      </Link>
      {collapsible ? (
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? 'Collapse section' : 'Expand section'}
          className="text-fd-muted-foreground hover:bg-fd-accent/50 -m-1.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md"
          onClick={() => setOpen(!open)}
        >
          <ChevronDown
            className={cn('size-4 transition-transform', !open && '-rotate-90 rtl:rotate-90')}
          />
        </button>
      ) : null}
    </div>
  );
}

function FolderTrigger({ children }: { children: ReactNode }) {
  const { open, setOpen, collapsible } = useFolderState();
  const depth = useFolderDepth();

  if (!collapsible) {
    return (
      <div className={itemClass} style={{ paddingInlineStart: getItemOffset(depth - 1) }}>
        {children}
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-expanded={open}
      className={itemClass}
      style={{ paddingInlineStart: getItemOffset(depth - 1) }}
      onClick={() => setOpen(!open)}
    >
      {children}
      <ChevronDown
        className={cn('ms-auto size-4 transition-transform', !open && '-rotate-90 rtl:rotate-90')}
      />
    </button>
  );
}

export function DocsSidebarFolder({
  item,
  children,
}: {
  item: PageTree.Folder;
  children: ReactNode;
}) {
  const path = useTreePath();
  const pathname = usePathname();

  return (
    <SidebarFolder
      collapsible={item.collapsible !== false}
      defaultOpen={item.defaultOpen}
      active={path.includes(item)}
    >
      {item.index ? (
        <FolderLink
          href={item.index.url}
          active={isActivePath(item.index.url, pathname)}
          external={item.index.external}
        >
          {item.icon}
          {item.name}
        </FolderLink>
      ) : (
        <FolderTrigger>
          {item.icon}
          {item.name}
        </FolderTrigger>
      )}
      <InstantFolderContent>{children}</InstantFolderContent>
    </SidebarFolder>
  );
}
