'use client';

import { useEffect, type ReactNode } from 'react';
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
 * Sidebar folder accordion without Radix CollapsibleContent.
 *
 * Two embed bugs this avoids:
 * 1. CollapsibleContent + Presence waits for animationend (often never fires).
 * 2. fumadocs SidebarFolder sets `defaultOpen = active || …` and re-applies it
 *    via useOnChange. We pass `active={false}` so user collapses stick, and
 *    open once via effect when the route enters the folder.
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
    throw new Error('DocsSidebarFolder parts must render inside SidebarFolder');
  }
  return folder;
}

/** Open when the route enters this folder; never force-reopen on every render. */
function OpenWhenActive({ active }: { active: boolean }) {
  const { setOpen } = useFolderState();
  useEffect(() => {
    if (active) setOpen(true);
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

function ToggleChevron() {
  const { open, setOpen, collapsible } = useFolderState();
  if (!collapsible) return null;

  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={open ? 'Collapse section' : 'Expand section'}
      className="text-fd-muted-foreground hover:bg-fd-accent/50 relative z-10 -m-1.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen((prev) => !prev);
      }}
    >
      <ChevronDown
        className={cn('size-4 transition-transform', !open && '-rotate-90 rtl:rotate-90')}
        aria-hidden
      />
    </button>
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
      <ToggleChevron />
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
      onClick={(e) => {
        e.preventDefault();
        setOpen((prev) => !prev);
      }}
    >
      {children}
      <ChevronDown
        className={cn('ms-auto size-4 transition-transform', !open && '-rotate-90 rtl:rotate-90')}
        aria-hidden
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
  const active = path.includes(item);
  const collapsible = item.collapsible !== false;

  return (
    <SidebarFolder
      collapsible={collapsible}
      // Initial open only. Pass active={false} so useOnChange cannot fight toggles.
      defaultOpen={active || Boolean(item.defaultOpen)}
      active={false}
    >
      <OpenWhenActive active={active} />
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
