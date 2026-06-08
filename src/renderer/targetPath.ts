import path from "node:path";
import type { Session } from "../types.js";
import { shortHash } from "../utils/hash.js";
import { formatDatePart, formatMonthPart } from "../utils/time.js";

export function resolveTargetPath({
  session,
  targetRoot,
  disambiguator,
}: {
  session: Session;
  targetRoot: string;
  disambiguator?: string;
}): string {
  const datePart = formatDatePart(session.createdAt, session.sourceModifiedAt ?? new Date().toISOString());
  const monthPart = formatMonthPart(datePart);
  const shortId = session.id.slice(0, 8);
  const suffix = disambiguator ? `-${disambiguator}` : "";
  return path.join(targetRoot, monthPart, `${datePart}_session-${shortId}${suffix}.md`);
}

export function getTargetPathDisambiguator(session: Session): string {
  return shortHash(session.id, 6);
}
