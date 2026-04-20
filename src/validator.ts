// ============================================================
// ADF 1.0 — Document Validator
// Checks a parsed ADFDocument against the ADF 1.0 spec rules.
// ============================================================

import { code as lookupCurrency } from 'currency-codes-ts';
import { isValid as isValidCountry } from 'i18n-iso-countries/index.js';
import type {
  ADFDocument,
  ADFProspect,
  ADFVehicle,
  ADFCustomer,
  ADFVendor,
  ADFProvider,
  ADFContact,
  ADFId,
  ADFOption,
  ADFFinance,
  ADFColorCombination,
} from './types.ts';
import type { ValidationIssue, ValidationResult } from './errors.ts';

// ----------------------------------------------------------
// ISO validation helpers
// ----------------------------------------------------------

// ISO 8601 patterns supported by the ADF spec (section 5 of spec)
const ISO8601_PATTERNS = [
  /^\d{8}T\d{6}[+-]\d{4}$/,        // CCYYMMDDThhmmss+hhmm
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/, // CCYY-MM-DDThh:mm:ss+hh:mm
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,  // CCYY-MM-DDThh:mm:ssZ
];

function isValidISO8601(value: string): boolean {
  return ISO8601_PATTERNS.some((re) => re.test(value)) || !isNaN(Date.parse(value));
}

function isValidCountryCode(countryCode: string): boolean {
  return isValidCountry(countryCode);
}

function isValidCurrencyCode(currency: string): boolean {
  return lookupCurrency(currency) !== undefined;
}

// VIN must be 17 alphanumeric chars excluding I, O, Q
function isValidVIN(vin: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin);
}

// ----------------------------------------------------------
// Collector helper
// ----------------------------------------------------------

class IssueCollector {
  readonly errors: ValidationIssue[] = [];
  readonly warnings: ValidationIssue[] = [];

  error(path: string, message: string): void {
    this.errors.push({ path, message, severity: 'error' });
  }

  warn(path: string, message: string): void {
    this.warnings.push({ path, message, severity: 'warning' });
  }

  require(
    path: string,
    value: unknown,
    fieldName: string,
  ): boolean {
    if (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '')
    ) {
      this.error(path, `${fieldName} is required`);
      return false;
    }
    return true;
  }

  requireArray(
    path: string,
    arr: unknown[],
    minLength: number,
    description: string,
  ): boolean {
    if (arr.length < minLength) {
      this.error(path, `${description}: at least ${minLength} required, got ${arr.length}`);
      return false;
    }
    return true;
  }
}

// ----------------------------------------------------------
// Entity validators
// ----------------------------------------------------------

function validateIds(col: IssueCollector, ids: ADFId[], path: string): void {
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!;
    const p = `${path}.ids[${i}]`;
    if (!id.source) {
      col.error(p, '<id> source attribute is required by the spec');
    }
    if (!id.value.trim()) {
      col.error(p, '<id> must have a non-empty value');
    }
  }
}

function validateContact(
  col: IssueCollector,
  contact: ADFContact,
  path: string,
): void {
  if (contact.names.length === 0) {
    col.error(path, 'contact must have at least one <name>');
  }

  const hasEmail = contact.emails.length > 0 && contact.emails.some((e) => e.value.trim() !== '');
  const hasPhone = contact.phones.length > 0 && contact.phones.some((p) => p.value.trim() !== '');

  if (!hasEmail && !hasPhone) {
    col.error(path, 'contact must have at least one <email> or <phone>');
  }

  for (let i = 0; i < contact.emails.length; i++) {
    const email = contact.emails[i]!;
    const ep = `${path}.emails[${i}]`;
    if (!email.value.trim()) {
      col.error(ep, 'email value must not be empty');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
      col.warn(ep, `"${email.value}" does not look like a valid email address`);
    }
  }

  for (let i = 0; i < contact.phones.length; i++) {
    const phone = contact.phones[i]!;
    if (!phone.value.trim()) {
      col.error(`${path}.phones[${i}]`, 'phone value must not be empty');
    }
  }

  if (contact.address) {
    const ap = `${path}.address`;
    if (contact.address.streets.length === 0) {
      col.warn(ap, 'address has no <street> lines');
    }
    if (contact.address.streets.length > 5) {
      col.error(ap, 'address may have at most 5 <street> lines (per DTD)');
    }
    if (
      contact.address.country &&
      !isValidCountryCode(contact.address.country)
    ) {
      col.warn(
        `${ap}.country`,
        `"${contact.address.country}" does not look like a valid ISO 3166-1 alpha-2 country code`,
      );
    }
  }
}

function validateVehicle(
  col: IssueCollector,
  vehicle: ADFVehicle,
  path: string,
): void {
  validateIds(col, vehicle.ids, path);

  if (!vehicle.year || vehicle.year < 1886 || vehicle.year > 2100) {
    col.warn(path, `year "${vehicle.year}" is outside the expected range (1886–2100)`);
  }

  col.require(path, vehicle.make, 'vehicle.make');
  col.require(path, vehicle.model, 'vehicle.model');

  if (vehicle.vin && !isValidVIN(vehicle.vin)) {
    col.warn(
      `${path}.vin`,
      `VIN "${vehicle.vin}" does not match the standard 17-character format`,
    );
  }

  if (vehicle.price?.currency && !isValidCurrencyCode(vehicle.price.currency)) {
    col.warn(
      `${path}.price.currency`,
      `"${vehicle.price.currency}" does not look like a valid ISO 4217 currency code`,
    );
  }

  for (let i = 0; i < vehicle.colorCombinations.length; i++) {
    validateColorCombination(col, vehicle.colorCombinations[i]!, `${path}.colorCombinations[${i}]`);
  }

  for (let i = 0; i < vehicle.options.length; i++) {
    validateOption(col, vehicle.options[i]!, `${path}.options[${i}]`);
  }

  if (vehicle.finance) {
    validateFinance(col, vehicle.finance, `${path}.finance`);
  }

  if (vehicle.odometer) {
    if (vehicle.odometer.value < 0) {
      col.warn(`${path}.odometer`, 'odometer value is negative');
    }
  }
}

function validateColorCombination(
  col: IssueCollector,
  cc: ADFColorCombination,
  path: string,
): void {
  if (!cc.interiorColor && !cc.exteriorColor) {
    col.warn(path, 'colorcombination has neither interiorcolor nor exteriorcolor');
  }
  if (cc.preference !== undefined && (cc.preference < 1 || !Number.isInteger(cc.preference))) {
    col.warn(`${path}.preference`, `preference must be a positive integer, got "${cc.preference}"`);
  }
}

function validateOption(
  col: IssueCollector,
  option: ADFOption,
  path: string,
): void {
  col.require(path, option.optionName, 'option.optionName');

  if (
    option.weighting !== undefined &&
    (option.weighting < -100 || option.weighting > 100)
  ) {
    col.error(
      `${path}.weighting`,
      `weighting must be between -100 and +100, got ${option.weighting}`,
    );
  }
}

function validateFinance(
  col: IssueCollector,
  finance: ADFFinance,
  path: string,
): void {
  col.require(path, finance.method, 'finance.method');

  if (finance.amounts.length === 0) {
    col.error(path, 'finance must contain at least one <amount>');
  }

  for (let i = 0; i < finance.amounts.length; i++) {
    const amount = finance.amounts[i]!;
    const ap = `${path}.amounts[${i}]`;
    if (amount.value < 0) {
      col.warn(ap, `amount value is negative: ${amount.value}`);
    }
    if (amount.currency && !isValidCurrencyCode(amount.currency)) {
      col.warn(`${ap}.currency`, `"${amount.currency}" is not a valid ISO 4217 code`);
    }
  }

  if (finance.balance) {
    if (finance.balance.value < 0) {
      col.warn(`${path}.balance`, `balance value is negative: ${finance.balance.value}`);
    }
    if (finance.balance.currency && !isValidCurrencyCode(finance.balance.currency)) {
      col.warn(
        `${path}.balance.currency`,
        `"${finance.balance.currency}" is not a valid ISO 4217 code`,
      );
    }
  }
}

function validateCustomer(
  col: IssueCollector,
  customer: ADFCustomer,
  path: string,
): void {
  validateIds(col, customer.ids, path);
  validateContact(col, customer.contact, `${path}.contact`);

  if (customer.timeFrame) {
    const tf = customer.timeFrame;
    const tfp = `${path}.timeFrame`;
    if (!tf.description && !tf.earliestDate && !tf.latestDate) {
      col.warn(tfp, 'timeFrame is present but has no description, earliestDate, or latestDate');
    }
    if (tf.earliestDate && !isValidISO8601(tf.earliestDate)) {
      col.warn(`${tfp}.earliestDate`, `"${tf.earliestDate}" does not appear to be a valid ISO 8601 date`);
    }
    if (tf.latestDate && !isValidISO8601(tf.latestDate)) {
      col.warn(`${tfp}.latestDate`, `"${tf.latestDate}" does not appear to be a valid ISO 8601 date`);
    }
    if (
      tf.earliestDate &&
      tf.latestDate &&
      new Date(tf.earliestDate) > new Date(tf.latestDate)
    ) {
      col.warn(tfp, 'earliestDate is after latestDate');
    }
  }
}

function validateVendor(
  col: IssueCollector,
  vendor: ADFVendor,
  path: string,
): void {
  validateIds(col, vendor.ids, path);
  col.require(path, vendor.vendorName, 'vendor.vendorName');
  validateContact(col, vendor.contact, `${path}.contact`);
}

function validateProvider(
  col: IssueCollector,
  provider: ADFProvider,
  path: string,
): void {
  validateIds(col, provider.ids, path);

  if (!provider.name.value.trim()) {
    col.error(`${path}.name`, 'provider name must not be empty');
  }

  if (provider.contact) {
    validateContact(col, provider.contact, `${path}.contact`);
  }
}

function validateProspect(
  col: IssueCollector,
  prospect: ADFProspect,
  path: string,
): void {
  validateIds(col, prospect.ids, path);

  // requestdate is required
  col.require(path, prospect.requestDate, 'prospect.requestDate');
  if (prospect.requestDate && !isValidISO8601(prospect.requestDate)) {
    col.warn(
      `${path}.requestDate`,
      `"${prospect.requestDate}" does not conform to the ISO 8601 formats required by the ADF spec`,
    );
  }

  // At least one vehicle is required
  col.requireArray(path, prospect.vehicles, 1, 'vehicles');

  for (let i = 0; i < prospect.vehicles.length; i++) {
    validateVehicle(col, prospect.vehicles[i]!, `${path}.vehicles[${i}]`);
  }

  validateCustomer(col, prospect.customer, `${path}.customer`);
  validateVendor(col, prospect.vendor, `${path}.vendor`);

  if (prospect.provider) {
    validateProvider(col, prospect.provider, `${path}.provider`);
  }
}

// ----------------------------------------------------------
// Public API
// ----------------------------------------------------------

/**
 * Validate an {@link ADFDocument} against the ADF 1.0 specification.
 *
 * Checks required fields, ISO 8601 dates, VIN format, ISO 4217 currency codes,
 * ISO 3166-1 country codes, email format, and numeric range constraints.
 *
 * @param doc - A parsed or built {@link ADFDocument}.
 * @returns A {@link ValidationResult} with `valid`, `errors`, and `warnings`.
 *   Errors are spec violations; warnings are non-fatal advisory issues.
 *   Never throws — inspect `result.valid` to determine pass/fail.
 *
 * @example
 * ```ts
 * const result = validate(doc);
 * if (!result.valid) {
 *   for (const issue of result.errors) {
 *     console.error(`[${issue.path}] ${issue.message}`);
 *   }
 * }
 * ```
 */
export function validate(doc: ADFDocument): ValidationResult {
  const col = new IssueCollector();

  if (!doc.version) {
    col.warn('version', 'ADF version is not set; defaulting to "1.0"');
  }

  if (doc.prospects.length === 0) {
    col.error('prospects', 'ADF document must contain at least one <prospect>');
  }

  for (let i = 0; i < doc.prospects.length; i++) {
    validateProspect(col, doc.prospects[i]!, `prospects[${i}]`);
  }

  return {
    valid: col.errors.length === 0,
    errors: col.errors,
    warnings: col.warnings,
  };
}
