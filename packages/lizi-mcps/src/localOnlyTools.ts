/**
 * Countersign: helpers for agent tools that describe other computers. Under
 * LOCAL_ONLY the device link is off, so there are no other computers, and a tool
 * must neither take a parameter that targets one nor tell the model about one
 * (final review minor ruling 11; final fix round 1, journey-3). With the switch
 * off, every helper returns its input unchanged, so upstream behaviour stays.
 */
import { LOCAL_ONLY } from "@cindy/maker-shared/local-only";

/**
 * A tool input shape, or no fields under LOCAL_ONLY. Spread it into an input
 * shape; the schema then drops a stray argument for another computer. The type
 * stays the upstream one so handlers compile unchanged; under LOCAL_ONLY those
 * fields are always undefined, which every handler reads as "this computer".
 */
export function localOnlyShape<T extends object>(shape: T): T {
  return (LOCAL_ONLY ? {} : shape) as T;
}

/**
 * Tool text with each `[from, to]` replaced under LOCAL_ONLY (every occurrence).
 * Tests check the result names no other computer, so a cut that no longer
 * matches the upstream text fails a test instead of passing silently.
 */
export function localOnlyText(
  text: string,
  cuts: ReadonlyArray<readonly [string, string]>,
): string {
  if (!LOCAL_ONLY) return text;
  return cuts.reduce((out, [from, to]) => out.split(from).join(to), text);
}

/** Description lines without those `drop` matches under LOCAL_ONLY. */
export function localOnlyLines(
  lines: readonly string[],
  drop: (line: string) => boolean,
): string[] {
  return LOCAL_ONLY ? lines.filter((line) => !drop(line)) : [...lines];
}
