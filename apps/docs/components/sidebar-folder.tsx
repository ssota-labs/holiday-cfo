'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import type * as PageTree from 'fumadocs-core/page-tree';
import Link from 'fumadocs-core/link';
import { usePathname } from 'fumadocs-core/framework';
import { useTreePath } from 'fumadocs-ui/contexts/tree';
import { SidebarFolder, useFolderDepth } from 'fumadocs-ui/components/sidebar/base';
import { ArrowUpRight, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/cn';

/**
 * Native sidebar folder accordion.
 *
 * `<details>/<summary>` owns the toggle, so browser-preview event interception
 * cannot break React state updates. The title toggles; the arrow is the link.
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

function FolderContent({ children }: { children: ReactNode }) {
  const depth = useFolderDepth();

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

function NativeFolder({
  item,
  href,
  active,
  external,
  label,
  folderChildren,
  children,
}: {
  item: PageTree.Folder;
  href: string;
  active: boolean;
  external?: boolean;
  label: string;
  folderChildren: ReactNode;
  children: ReactNode;
}) {
  const depth = useFolderDepth();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const wasActive = useRef(active);
  const initiallyOpen = useRef(active || Boolean(item.defaultOpen));

  useEffect(() => {
    if (detailsRef.current) detailsRef.current.open = initiallyOpen.current;
  }, []);

  useEffect(() => {
    if (active && !wasActive.current && detailsRef.current) {
      detailsRef.current.open = true;
    }
    wasActive.current = active;
  }, [active]);

  return (
    <details ref={detailsRef} className="group/sidebar-folder">
      <summary
        className={cn(
          itemClass,
          'cursor-pointer list-none [&::-webkit-details-marker]:hidden',
          active && 'bg-fd-primary/10 text-fd-primary',
        )}
        style={{ paddingInlineStart: getItemOffset(depth - 1) }}
        data-active={active}
        title={`${label} 접기/펼치기`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {children}
          <ChevronDown
            className="text-fd-muted-foreground ms-auto size-4 shrink-0 -rotate-90 transition-transform group-open/sidebar-folder:rotate-0 rtl:rotate-90 rtl:group-open/sidebar-folder:rotate-0"
            aria-hidden
          />
        </span>
        <Link
          href={href}
          external={external}
          title={`${label} 페이지로 이동`}
          aria-label={`${label} 페이지로 이동`}
          className="text-fd-muted-foreground hover:bg-fd-accent/80 hover:text-fd-accent-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-md"
          onClick={(event) => event.stopPropagation()}
        >
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </summary>
      <FolderContent>{folderChildren}</FolderContent>
    </details>
  );
}

function NativeFolderWithoutIndex({
  item,
  active,
  label,
  children,
}: {
  item: PageTree.Folder;
  active: boolean;
  label: string;
  children: ReactNode;
}) {
  const depth = useFolderDepth();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const initiallyOpen = useRef(active || Boolean(item.defaultOpen));

  useEffect(() => {
    if (detailsRef.current) detailsRef.current.open = initiallyOpen.current;
  }, []);

  return (
    <details ref={detailsRef} className="group/sidebar-folder">
      <summary
        className={cn(itemClass, 'cursor-pointer list-none [&::-webkit-details-marker]:hidden')}
        style={{ paddingInlineStart: getItemOffset(depth - 1) }}
        title={`${label} 접기/펼치기`}
      >
        {item.icon}
        {item.name}
        <ChevronDown
          className="ms-auto size-4 -rotate-90 transition-transform group-open/sidebar-folder:rotate-0 rtl:rotate-90 rtl:group-open/sidebar-folder:rotate-0"
          aria-hidden
        />
      </summary>
      <FolderContent>{children}</FolderContent>
    </details>
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
  const label = folderLabel(item.name);

  return (
    <SidebarFolder
      collapsible={false}
      active={false}
    >
      {item.index ? (
        <NativeFolder
          item={item}
          href={item.index.url}
          active={isActivePath(item.index.url, pathname)}
          external={item.index.external}
          label={label}
          folderChildren={children}
        >
          {item.icon}
          {item.name}
        </NativeFolder>
      ) : (
        <NativeFolderWithoutIndex item={item} active={active} label={label}>
          {children}
        </NativeFolderWithoutIndex>
      )}
    </SidebarFolder>
  );
}
