// ============================================================
// ADF Parser — Error Types
// ============================================================

export type IssueSeverity = 'error' | 'warning';

/** A single validation finding */
export interface ValidationIssue {
  /** Dot-separated path to the offending field (e.g. "prospects[0].customer.contact") */
  path: string;
  message: string;
  severity: IssueSeverity;
}

/** Result of a full document validation pass */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

/** Thrown when the raw XML cannot be parsed into an ADFDocument */
export class ADFParseError extends Error {
  override readonly name = 'ADFParseError';

  constructor(message: string, readonly cause?: unknown) {
    super(message);
  }
}

/** Thrown when parse + validate is called and validation fails */
export class ADFValidationError extends Error {
  override readonly name = 'ADFValidationError';

  constructor(
    message: string,
    readonly issues: ValidationIssue[],
  ) {
    super(message);
  }
}
