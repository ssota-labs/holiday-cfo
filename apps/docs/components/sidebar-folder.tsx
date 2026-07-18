'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import type * as PageTree from 'fumadocs-core/page-tree';
import Link from 'fumadocs-core/link';
import { usePathname } from 'fumadocs-core/framework';
import { useTreePath } from 'fumadocs-ui/contexts/tree';
import {
  SidebarFolder,
  useFolder,
  useFolderDepth,
} from 'fumadocs-ui/components/sidebar/base';
import { ArrowUpRight, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/cn';

/**
 * Sidebar folder accordion without Radix CollapsibleContent.
 *
 * Folder title is a toggle button (not a link) so clicks collapse/expand
 * instead of navigating. A separate arrow icon links to the folder index.
 */

const itemClass =
  'relative flex flex-row items-center gap-1 rounded-lg p-2 text-start text-fd-muted-foreground wrap-anywhere [&_svg]:size-4 [&_svg]:shrink-0 transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80 hover:transition-none data-[active=true]:bg-fd-primary/10 data-[active=true]:text-fd-primary data-[active=true]:hover:transition-colors w-full';

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
    throw new Error('DocsSidebarFolder parts must render inside SidebarFolder');
  }
  return folder;
}

/** Open only when the route newly enters this folder. */
function OpenWhenActive({ active }: { active: boolean }) {
  const { setOpen } = useFolderState();
  const wasActive = useRef(active);

  useEffect(() => {
    if (active && !wasActive.current) setOpen(true);
    wasActive.current = active;
  }, [active, setOpen]);

  return null;
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
  label,
  children,
}: {
  href: string;
  active: boolean;
  external?: boolean;
  label: string;
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
      {/* Title = accordion toggle only. Not a link. */}
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? `${label} 접기` : `${label} 펼치기`}
        title={open ? '접기' : '펼치기'}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        disabled={!collapsible}
        onClick={() => {
          if (collapsible) setOpen((prev) => !prev);
        }}
      >
        {children}
        {collapsible ? (
          <ChevronDown
            className={cn(
              'text-fd-muted-foreground ms-auto size-4 shrink-0 transition-transform',
              !open && '-rotate-90 rtl:rotate-90',
            )}
            aria-hidden
          />
        ) : null}
      </button>

      {/* Separate control to open the folder index page. */}
      <Link
        href={href}
        external={external}
        title={`${label} 페이지로 이동`}
        aria-label={`${label} 페이지로 이동`}
        className="text-fd-muted-foreground hover:bg-fd-accent/80 hover:text-fd-accent-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-md"
        onClick={(e) => e.stopPropagation()}
      >
        <ArrowUpRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}

function FolderTrigger({ label, children }: { label: string; children: ReactNode }) {
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
      aria-label={open ? `${label} 접기` : `${label} 펼치기`}
      title={open ? '접기' : '펼치기'}
      className={itemClass}
      style={{ paddingInlineStart: getItemOffset(depth - 1) }}
      onClick={() => setOpen((prev) => !prev)}
    >
      {children}
      <ChevronDown
        className={cn('ms-auto size-4 transition-transform', !open && '-rotate-90 rtl:rotate-90')}
        aria-hidden
      />
    </button>
  );
}

function folderLabel(name: ReactNode): string {
  if (typeof name === 'string' || typeof name === 'number') return String(name);
  return '섹션';
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
  const active = path.includes(item);
  const collapsible = item.collapsible !== false;
  const label = folderLabel(item.name);

  return (
    <SidebarFolder
      collapsible={collapsible}
      defaultOpen={active || Boolean(item.defaultOpen)}
      active={false}
    >
      <OpenWhenActive active={active} />
      {item.index ? (
        <FolderLink
          href={item.index.url}
          active={isActivePath(item.index.url, pathname)}
          external={item.index.external}
          label={label}
        >
          {item.icon}
          {item.name}
        </FolderLink>
      ) : (
        <FolderTrigger label={label}>
          {item.icon}
          {item.name}
        </FolderTrigger>
      )}
      <InstantFolderContent>{children}</InstantFolderContent>
    </SidebarFolder>
  );
}
