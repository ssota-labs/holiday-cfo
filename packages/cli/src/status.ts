import { rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  ledgerStatus,
  renderLedgerStatusMarkdown,
  type LedgerStore,
} from '@holiday-cfo/core';

export interface WriteLedgerStatusResult {
  readonly statusPath: string;
  readonly generatedAt: string;
}

export async function writeLedgerStatus(
  workspacePath: string,
  store: LedgerStore,
  timezone: string,
  now = new Date(),
): Promise<WriteLedgerStatusResult> {
  const generatedAt = isoTimestampInTimeZone(now, timezone);
  const snapshot = await store.read((read) => ledgerStatus(read, generatedAt));
  const markdown = renderLedgerStatusMarkdown(snapshot);
  const statusPath = join(dirname(workspacePath), 'status.md');
  const temporaryPath = `${statusPath}.tmp-${process.pid}-${Date.now()}`;

  try {
    await writeFile(temporaryPath, markdown, 'utf8');
    await rename(temporaryPath, statusPath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }

  return { statusPath, generatedAt };
}

export function isoTimestampInTimeZone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const offset = parts.timeZoneName === 'GMT' ? 'Z' : parts.timeZoneName?.replace('GMT', '');
  if (
    !parts.year ||
    !parts.month ||
    !parts.day ||
    !parts.hour ||
    !parts.minute ||
    !parts.second ||
    !offset
  ) {
    throw new RangeError(`cannot format timestamp in timezone ${timezone}`);
  }
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
}
