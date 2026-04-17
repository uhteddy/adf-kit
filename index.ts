// ============================================================
// ADF Parser — Public API
// Auto-lead Data Format (ADF) 1.0 — parse, validate, generate.
// Spec: https://adfxml.info/adf_spec.pdf
// ============================================================

// ----------------------------------------------------------
// Parsing — XML → typed ADFDocument
// ----------------------------------------------------------
export { parse } from './src/parser.ts';

// ----------------------------------------------------------
// Validation
// ----------------------------------------------------------
export { validate } from './src/validator.ts';

// ----------------------------------------------------------
// Low-level serialization — ADFDocument → XML string
// (Use the builder / generator API below for new leads)
// ----------------------------------------------------------
export { serialize } from './src/serializer.ts';

// ----------------------------------------------------------
// Generation — build ADF leads without reading the spec
//
// Fluent builder (recommended):
//   new ADFProspectBuilder()
//     .vehicle({ year: 2024, make: 'Toyota', model: 'Camry' })
//     .customer({ firstName: 'Jane', email: 'jane@example.com' })
//     .vendor({ name: 'Sunrise Toyota', email: 'leads@sunrise.com' })
//     .string()   // XML string — use as HTTP body, save to file, etc.
//     .xml()      // Blob (application/xml) — fetch body or email attachment
//
// Multi-prospect document:
//   new ADFBuilder()
//     .prospect(p => p.vehicle(...).customer(...).vendor(...))
//     .prospect(p => p.vehicle(...).customer(...).vendor(...))
//     .string()
//
// One-shot factories (simpler for scripting):
//   generateProspect({ vehicle, customer, vendor })
//   generateADF({ prospects: [...] })
// ----------------------------------------------------------
export {
  ADFProspectBuilder,
  ADFBuilder,
  buildProspect,
  buildDocument,
  generateProspect,
  generateADF,
} from './src/generator.ts';

// ----------------------------------------------------------
// Fully-typed ADF entity interfaces (parsed / built documents)
// ----------------------------------------------------------
export type { CurrencyCode } from 'currency-codes-ts/dist/types';
export type { Alpha2Code } from 'i18n-iso-countries';

export type {
  ADFDocument,
  ADFProspect,
  ADFVehicle,
  ADFCustomer,
  ADFVendor,
  ADFProvider,
  ADFContact,
  ADFId,
  ADFName,
  ADFEmail,
  ADFPhone,
  ADFAddress,
  ADFStreet,
  ADFOdometer,
  ADFColorCombination,
  ADFImageTag,
  ADFPrice,
  ADFOption,
  ADFFinance,
  ADFAmount,
  ADFBalance,
  ADFTimeFrame,
  // Enum literal types
  ProspectStatus,
  VehicleInterest,
  VehicleStatus,
  OdometerStatus,
  OdometerUnits,
  VehicleCondition,
  PriceType,
  PriceDelta,
  PriceRelativeTo,
  FinanceMethod,
  AmountType,
  AmountLimit,
  BalanceType,
  NamePart,
  NameType,
  PhoneType,
  PhoneTime,
  AddressType,
} from './src/types.ts';

// ----------------------------------------------------------
// Simplified input types (for the builder / generator API)
// ----------------------------------------------------------
export type {
  ADFInput,
  ProspectInput,
  VehicleInput,
  CustomerInput,
  VendorInput,
  ProviderInput,
  ContactInput,
  PhoneInput,
  AddressInput,
  ColorInput,
  PriceInput,
  OdometerInput,
  FinanceInput,
  OptionInput,
} from './src/generator.ts';

// ----------------------------------------------------------
// Errors and validation result types
// ----------------------------------------------------------
export type { ValidationIssue, ValidationResult, IssueSeverity } from './src/errors.ts';
export { ADFParseError, ADFValidationError } from './src/errors.ts';
