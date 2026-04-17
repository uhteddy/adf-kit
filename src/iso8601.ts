// ============================================================
// ISO 8601 Branded Date Types
//
// Branded types prevent plain `string` from being assigned where
// a validated date is required, while remaining plain strings at
// runtime — no wrapping, no serialization cost.
//
// Usage:
//   import { dateTime, date, formatDateTime } from './iso8601.ts';
//
//   const dt: ISO8601DateTime = dateTime('2024-01-15T10:30:00-08:00');  // validated
//   const d:  ISO8601Date     = date('2024-05-01');                      // validated
//   const now: ISO8601DateTime = formatDateTime(new Date());             // from Date
// ============================================================

declare const __dateTimeBrand: unique symbol;
declare const __dateBrand: unique symbol;

/**
 * A validated ISO 8601 date-time string.
 *
 * Accepted formats (ADF 1.0 spec §5.3 / §5.4):
 *   `CCYY-MM-DDThh:mm:ss+hh:mm`   (extended with tz offset)
 *   `CCYY-MM-DDThh:mm:ssZ`         (extended with UTC)
 *   `CCYY-MM-DDThh:mm:ss.sssZ`     (extended with ms, from JS Date)
 *   `CCYYMMDDThhmmss+hhmm`         (basic with tz offset)
 *   `CCYYMMDDThhmmssZ`             (basic with UTC)
 *
 * Construct with {@link dateTime} (throws on invalid) or
 * {@link parseDateTime} (returns `undefined` on invalid).
 * Convert a `Date` with {@link formatDateTime}.
 */
export type ISO8601DateTime = string & { readonly [__dateTimeBrand]: never };

/**
 * A validated ISO 8601 date-only string.
 *
 * Accepted formats:
 *   `CCYY-MM-DD`  (extended)
 *   `CCYYMMDD`    (basic)
 *
 * Construct with {@link date} (throws) or {@link parseDate} (safe).
 * Convert a `Date` with {@link formatDate}.
 */
export type ISO8601Date = string & { readonly [__dateBrand]: never };

// ----------------------------------------------------------
// Validation predicates (exported for use in validator.ts)
// ----------------------------------------------------------

const DATETIME_RES = [
  // Extended: CCYY-MM-DDThh:mm:ss[.sss](Z|±hh:mm)
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
  // Basic: CCYYMMDDThhmmss(Z|±hhmm)
  /^\d{8}T\d{6}(\.\d+)?(Z|[+-]\d{4})$/,
] as const;

const DATE_RE = /^(\d{4}-\d{2}-\d{2}|\d{8})$/;

/** Returns `true` when `value` is a valid ISO 8601 datetime. */
export function isISO8601DateTime(value: string): boolean {
  return DATETIME_RES.some((re) => re.test(value)) && !isNaN(Date.parse(value));
}

/** Returns `true` when `value` is a valid ISO 8601 date (no time component). */
export function isISO8601Date(value: string): boolean {
  return DATE_RE.test(value) && !isNaN(Date.parse(value));
}

// ----------------------------------------------------------
// Throwing constructors
// ----------------------------------------------------------

/**
 * Validate and brand `value` as {@link ISO8601DateTime}.
 * @throws {TypeError} when `value` is not a valid ISO 8601 datetime.
 */
export function dateTime(value: string): ISO8601DateTime {
  if (!isISO8601DateTime(value)) {
    throw new TypeError(
      `"${value}" is not a valid ISO 8601 datetime. ` +
        'Expected e.g. "2024-01-15T10:30:00-08:00" or "20240115T103000Z".',
    );
  }
  return value as ISO8601DateTime;
}

/**
 * Validate and brand `value` as {@link ISO8601Date}.
 * @throws {TypeError} when `value` is not a valid ISO 8601 date.
 */
export function date(value: string): ISO8601Date {
  if (!isISO8601Date(value)) {
    throw new TypeError(
      `"${value}" is not a valid ISO 8601 date. Expected e.g. "2024-01-15".`,
    );
  }
  return value as ISO8601Date;
}

// ----------------------------------------------------------
// Safe parsers (return undefined instead of throwing)
// ----------------------------------------------------------

/** Parse `value` into {@link ISO8601DateTime}, returning `undefined` if invalid. */
export function parseDateTime(value: string): ISO8601DateTime | undefined {
  return isISO8601DateTime(value) ? (value as ISO8601DateTime) : undefined;
}

/** Parse `value` into {@link ISO8601Date}, returning `undefined` if invalid. */
export function parseDate(value: string): ISO8601Date | undefined {
  return isISO8601Date(value) ? (value as ISO8601Date) : undefined;
}

// ----------------------------------------------------------
// Formatters — convert a JS Date to a branded string
// ----------------------------------------------------------

/**
 * Format a `Date` object as an {@link ISO8601DateTime} string.
 * Produces `CCYY-MM-DDThh:mm:ssZ` (UTC, no milliseconds).
 */
export function formatDateTime(d: Date): ISO8601DateTime {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z') as ISO8601DateTime;
}

/**
 * Format a `Date` object as an {@link ISO8601Date} string (`CCYY-MM-DD`).
 */
export function formatDate(d: Date): ISO8601Date {
  return d.toISOString().slice(0, 10) as ISO8601Date;
}

// ----------------------------------------------------------
// Internal coercion helpers (used by parser and generator)
// ----------------------------------------------------------

/**
 * Coerce a `Date`, branded string, raw string, or `undefined` to
 * {@link ISO8601DateTime}. Falls back to the current UTC time.
 *
 * The parser calls this with trust-and-cast; `validate()` performs
 * the semantic check.
 */
export function coerceDateTime(
  value: Date | string | undefined,
): ISO8601DateTime {
  if (!value) return formatDateTime(new Date());
  if (value instanceof Date) return formatDateTime(value);
  return value as ISO8601DateTime;
}

/**
 * Coerce a `Date` or raw string to {@link ISO8601Date}.
 * Semantic validation is left to `validate()`.
 */
export function coerceDate(value: Date | string): ISO8601Date {
  if (value instanceof Date) return formatDate(value);
  return value as ISO8601Date;
}
