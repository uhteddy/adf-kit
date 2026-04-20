// ============================================================
// ADF 1.0 — Lead Generator & Builder
//
// Two ways to generate ADF XML:
//
//   1. Fluent builder (recommended):
//      new ADFProspectBuilder()
//        .vehicle({ year: 2024, make: 'Toyota', model: 'Camry' })
//        .customer({ firstName: 'John', lastName: 'Doe', email: 'j@example.com' })
//        .vendor({ name: 'Acme Toyota', email: 'sales@acme.com' })
//        .string()   // → XML string (use as HTTP body, file, etc.)
//        .xml()      // → Blob (application/xml, attach to email or fetch body directly)
//
//   2. One-shot factory:
//      generateProspect({ vehicle: {...}, customer: {...}, vendor: {...} })
// ============================================================

import type { CurrencyCode } from "currency-codes-ts/dist/types";
import type { Alpha2Code } from "i18n-iso-countries";
import { coerceDateTime, coerceDate } from "./iso8601.ts";
import type { ISO8601DateTime, ISO8601Date } from "./iso8601.ts";
import type {
  ADFDocument,
  ADFProspect,
  ADFVehicle,
  ADFCustomer,
  ADFVendor,
  ADFProvider,
  ADFContact,
  ADFName,
  ADFEmail,
  ADFPhone,
  ADFAddress,
  ADFStreet,
  ADFOdometer,
  ADFColorCombination,
  ADFPrice,
  ADFOption,
  ADFFinance,
  ADFAmount,
  ADFBalance,
  ADFTimeFrame,
  ProspectStatus,
  VehicleInterest,
  VehicleStatus,
  OdometerStatus,
  OdometerUnits,
  VehicleCondition,
  PriceType,
  AmountLimit,
  PhoneType,
  PhoneTime,
  AddressType,
  NameType,
  FinanceMethod,
} from "./types.ts";
import { serialize } from "./serializer.ts";

// ============================================================
// Simplified input types
// ============================================================

export interface OptionInput {
  name: string;
  /** Manufacturer's option code */
  manufacturerCode?: string;
  /** Importance: +100 = essential to have, -100 = essential NOT to have, 0 = don't care */
  weighting?: number;
  stock?: string;
}

export interface ColorInput {
  interior?: string;
  exterior?: string;
  /** 1 = most preferred. Auto-assigned in order if omitted. */
  preference?: number;
}

export interface PriceInput {
  value: number;
  type?: PriceType;
  /** ISO 4217 currency code, e.g. "USD" */
  currency?: CurrencyCode;
  /** Where this price came from, e.g. "Kelley Blue Book" */
  source?: string;
}

export interface OdometerInput {
  value: number;
  units?: OdometerUnits;
  status?: OdometerStatus;
}

export interface FinanceInput {
  method?: FinanceMethod;
  downPayment?: number;
  monthlyPayment?: number;
  totalAmount?: number;
  /** ISO 4217 currency code */
  currency?: CurrencyCode;
  /** Remaining balance (e.g. lease residual or trade-in payoff) */
  residualBalance?: number;
}

export interface PhoneInput {
  number: string;
  type?: PhoneType;
  time?: PhoneTime;
  preferred?: boolean;
}

export interface AddressInput {
  /** One line or up to 5 lines */
  street: string | string[];
  apartment?: string;
  city?: string;
  /** State or province code, e.g. "TX", "CA" */
  regionCode?: string;
  /** ZIP / postal code */
  postalCode?: string;
  /** ISO 3166-1 alpha-2 country code, e.g. "US" */
  country?: Alpha2Code;
  type?: AddressType;
}

export interface VehicleInput {
  year: number;
  make: string;
  model: string;
  vin?: string;
  /** Dealer stock number */
  stock?: string;
  trim?: string;
  doors?: number;
  /** e.g. "SUV", "Sedan", "Coupe" */
  bodyStyle?: string;
  /** "A" for automatic, "M" for manual */
  transmission?: string;
  /** What the customer wants to do with this vehicle */
  interest?: VehicleInterest;
  status?: VehicleStatus;
  condition?: VehicleCondition;
  /** Asking / quoted price */
  price?: number | PriceInput;
  mileage?: number | OdometerInput;
  colors?: ColorInput | ColorInput[];
  options?: (string | OptionInput)[];
  finance?: FinanceInput;
  comments?: string;
}

/** Contact details shared by customer, vendor contact, and provider contact */
export interface ContactInput {
  firstName?: string;
  lastName?: string;
  /** Used when first/last are not available */
  fullName?: string;
  email?: string | string[];
  phone?: string | PhoneInput | Array<string | PhoneInput>;
  address?: AddressInput;
}

export interface CustomerInput extends ContactInput {
  /**
   * Purchase timeframe. Pass a plain string for a description,
   * or an object for structured earliest/latest dates.
   */
  timeFrame?:
    | string
    | {
        description?: string;
        earliest?: string | Date;
        latest?: string | Date;
      };
  comments?: string;
}

export interface VendorInput {
  /** Dealership or selling entity name (required) */
  name: string;
  url?: string;
  /** Name of the primary contact at the vendor */
  contactName?: string;
  email?: string;
  phone?: string;
}

export interface ProviderInput {
  /** Name of the lead source / service (required) */
  name: string;
  /** The specific service that originated the lead, e.g. "New Car Search" */
  service?: string;
  url?: string;
  email?: string;
  phone?: string;
  /** Optional named contact at the provider */
  contact?: ContactInput;
}

export interface ProspectInput {
  /** Defaults to the current time when omitted */
  requestDate?: Date | string;
  /** One or more vehicles the customer is interested in */
  vehicle: VehicleInput | VehicleInput[];
  customer: CustomerInput;
  vendor: VendorInput;
  provider?: ProviderInput;
  /** "new" (default) or "resend" */
  status?: ProspectStatus;
}

export interface ADFInput {
  prospects: ProspectInput | ProspectInput[];
  /** ADF spec version. Defaults to "1.0". */
  version?: string;
}

// ============================================================
// Internal conversion helpers
// ============================================================


function convertNames(
  c: ContactInput,
  nameType: NameType = "individual",
): ADFName[] {
  const names: ADFName[] = [];
  if (c.firstName)
    names.push({ value: c.firstName, part: "first", type: nameType });
  if (c.lastName)
    names.push({ value: c.lastName, part: "last", type: nameType });
  if (!c.firstName && !c.lastName && c.fullName) {
    names.push({ value: c.fullName, part: "full", type: nameType });
  }
  return names;
}

function convertEmails(c: ContactInput): ADFEmail[] {
  if (!c.email) return [];
  const arr = Array.isArray(c.email) ? c.email : [c.email];
  return arr.map((v, i) => ({ value: v, preferredContact: i === 0 }));
}

function convertPhone(p: string | PhoneInput): ADFPhone {
  if (typeof p === "string") {
    return {
      value: p,
      type: "voice",
      time: "nopreference",
      preferredContact: false,
    };
  }
  return {
    value: p.number,
    type: p.type ?? "voice",
    time: p.time ?? "nopreference",
    preferredContact: p.preferred ?? false,
  };
}

function convertPhones(c: ContactInput): ADFPhone[] {
  if (!c.phone) return [];
  const arr = Array.isArray(c.phone) ? c.phone : [c.phone];
  return arr.map(convertPhone);
}

function convertAddress(a: AddressInput): ADFAddress {
  const rawStreets = Array.isArray(a.street) ? a.street : [a.street];
  const streets: ADFStreet[] = rawStreets.map((v, i) => ({
    value: v,
    line: String(i + 1),
  }));
  return {
    streets,
    apartment: a.apartment,
    city: a.city,
    regionCode: a.regionCode,
    postalCode: a.postalCode,
    country: a.country,
    type: a.type,
  };
}

function convertContact(
  c: ContactInput,
  nameType: NameType = "individual",
): ADFContact {
  return {
    names: convertNames(c, nameType),
    emails: convertEmails(c),
    phones: convertPhones(c),
    address: c.address ? convertAddress(c.address) : undefined,
    primaryContact: false,
  };
}

function convertPrice(
  p: number | PriceInput | undefined,
): ADFPrice | undefined {
  if (p === undefined) return undefined;
  if (typeof p === "number") return { value: p, type: "quote" };
  return {
    value: p.value,
    type: p.type ?? "quote",
    currency: p.currency,
    source: p.source,
  };
}

function convertOdometer(
  m: number | OdometerInput | undefined,
): ADFOdometer | undefined {
  if (m === undefined) return undefined;
  if (typeof m === "number") return { value: m };
  return { value: m.value, units: m.units, status: m.status };
}

function convertColors(
  c: ColorInput | ColorInput[] | undefined,
): ADFColorCombination[] {
  if (!c) return [];
  const arr = Array.isArray(c) ? c : [c];
  return arr.map((cc, i) => ({
    interiorColor: cc.interior,
    exteriorColor: cc.exterior,
    preference: cc.preference ?? i + 1,
  }));
}

function convertOption(o: string | OptionInput): ADFOption {
  if (typeof o === "string") return { optionName: o };
  return {
    optionName: o.name,
    manufacturerCode: o.manufacturerCode,
    stock: o.stock,
    weighting: o.weighting,
  };
}

function convertFinance(f: FinanceInput | undefined): ADFFinance | undefined {
  if (!f) return undefined;

  const amounts: ADFAmount[] = [];
  const limit: AmountLimit = "exact";

  if (f.downPayment !== undefined)
    amounts.push({
      value: f.downPayment,
      type: "downpayment",
      limit,
      currency: f.currency,
    });
  if (f.monthlyPayment !== undefined)
    amounts.push({
      value: f.monthlyPayment,
      type: "monthly",
      limit,
      currency: f.currency,
    });
  if (f.totalAmount !== undefined)
    amounts.push({
      value: f.totalAmount,
      type: "total",
      limit,
      currency: f.currency,
    });

  const balance: ADFBalance | undefined =
    f.residualBalance !== undefined
      ? { value: f.residualBalance, type: "residual", currency: f.currency }
      : undefined;

  return {
    method: f.method ?? "finance",
    amounts:
      amounts.length > 0
        ? amounts
        : [{ value: 0, type: "total", limit: "maximum" }],
    balance,
  };
}

function convertVehicle(v: VehicleInput): ADFVehicle {
  return {
    ids: [],
    year: v.year,
    make: v.make,
    model: v.model,
    vin: v.vin,
    stock: v.stock,
    trim: v.trim,
    doors: v.doors,
    bodyStyle: v.bodyStyle,
    transmission: v.transmission,
    interest: v.interest ?? "buy",
    status: v.status ?? "new",
    condition: v.condition,
    odometer: convertOdometer(v.mileage),
    colorCombinations: convertColors(v.colors),
    imageTag: undefined,
    price: convertPrice(v.price),
    priceComments: undefined,
    options: (v.options ?? []).map(convertOption),
    finance: convertFinance(v.finance),
    comments: v.comments,
  };
}

function convertTimeFrame(
  tf: CustomerInput["timeFrame"],
): ADFTimeFrame | undefined {
  if (!tf) return undefined;
  if (typeof tf === "string") return { description: tf };
  return {
    description: tf.description,
    earliestDate: tf.earliest ? coerceDate(tf.earliest) : undefined,
    latestDate: tf.latest ? coerceDate(tf.latest) : undefined,
  };
}

function convertCustomer(c: CustomerInput): ADFCustomer {
  return {
    contact: convertContact(c, "individual"),
    ids: [],
    timeFrame: convertTimeFrame(c.timeFrame),
    comments: c.comments,
  };
}

function convertVendor(v: VendorInput): ADFVendor {
  // Vendor contact is built from whatever vendor contact info is available.
  const names: ADFName[] = [
    { value: v.contactName ?? v.name, part: "full", type: "business" },
  ];
  const emails: ADFEmail[] = v.email
    ? [{ value: v.email, preferredContact: true }]
    : [];
  const phones: ADFPhone[] = v.phone
    ? [
        {
          value: v.phone,
          type: "voice",
          time: "nopreference",
          preferredContact: false,
        },
      ]
    : [];

  return {
    ids: [],
    vendorName: v.name,
    url: v.url,
    contact: {
      names,
      emails,
      phones,
      address: undefined,
      primaryContact: true,
    },
  };
}

function convertProvider(p: ProviderInput): ADFProvider {
  let contact: ADFContact | undefined;
  if (p.contact) {
    contact = convertContact(p.contact, "individual");
    contact.primaryContact = true;
  }
  return {
    ids: [],
    name: { value: p.name, part: "full", type: "business" },
    service: p.service,
    url: p.url,
    email: p.email,
    phone: p.phone,
    contact,
  };
}

/** Convert a {@link ProspectInput} to a fully-typed {@link ADFProspect}. */
export function buildProspect(input: ProspectInput): ADFProspect {
  const vehicles = Array.isArray(input.vehicle)
    ? input.vehicle
    : [input.vehicle];
  return {
    ids: [],
    requestDate: coerceDateTime(input.requestDate),
    vehicles: vehicles.map(convertVehicle),
    customer: convertCustomer(input.customer),
    vendor: convertVendor(input.vendor),
    provider: input.provider ? convertProvider(input.provider) : undefined,
    status: input.status ?? "new",
  };
}

/** Convert an {@link ADFInput} to a fully-typed {@link ADFDocument}. */
export function buildDocument(input: ADFInput): ADFDocument {
  const prospects = Array.isArray(input.prospects)
    ? input.prospects
    : [input.prospects];
  return {
    version: input.version ?? "1.0",
    prospects: prospects.map(buildProspect),
  };
}

// ============================================================
// Terminal output helpers (shared by both builders)
// ============================================================

function toXMLString(doc: ADFDocument): string {
  return serialize(doc);
}

function toXMLBlob(doc: ADFDocument): Blob {
  return new Blob([toXMLString(doc)], { type: "application/xml" });
}

// ============================================================
// ADFProspectBuilder
// Fluent builder for a single ADF lead.
// ============================================================

/**
 * Fluent builder for a single ADF lead.
 *
 * @example
 * ```ts
 * const xmlString = new ADFProspectBuilder()
 *   .vehicle({ year: 2024, make: 'Toyota', model: 'Camry', price: 29995 })
 *   .customer({ firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' })
 *   .vendor({ name: 'Sunrise Toyota', email: 'leads@sunrise.com' })
 *   .string();
 *
 * // Or as a Blob for fetch / email attachment:
 * const blob = new ADFProspectBuilder()
 *   .vehicle(...)
 *   .customer(...)
 *   .vendor(...)
 *   .xml();
 *
 * // Send via fetch (no MIME header needed — Blob carries it):
 * await fetch(dealerEndpoint, { method: 'POST', body: blob });
 * ```
 */
/** Tracks which required fields have been set on {@link ADFProspectBuilder}. */
type ProspectReady = { vehicle: true; customer: true; vendor: true };

export class ADFProspectBuilder<S extends Partial<ProspectReady> = {}> {
  // Phantom field — never exists at runtime; makes S structurally nominal so
  // ADFProspectBuilder<{}> ≠ ADFProspectBuilder<ProspectReady> to the compiler.
  declare private _s: S;

  private _vehicles: VehicleInput[] = [];
  private _customer: CustomerInput | undefined;
  private _vendor: VendorInput | undefined;
  private _provider: ProviderInput | undefined;
  private _requestDate: Date | string | undefined;
  private _status: ProspectStatus = "new";

  /** Add a vehicle to this lead (call multiple times for multiple vehicles). */
  vehicle(input: VehicleInput): ADFProspectBuilder<S & { vehicle: true }> {
    this._vehicles.push(input);
    return this as any;
  }

  /** Set the customer (buyer) for this lead. */
  customer(input: CustomerInput): ADFProspectBuilder<S & { customer: true }> {
    this._customer = input;
    return this as any;
  }

  /** Set the vendor (dealer) this lead is for. */
  vendor(input: VendorInput): ADFProspectBuilder<S & { vendor: true }> {
    this._vendor = input;
    return this as any;
  }

  /** Optionally set the lead source / provider. */
  provider(input: ProviderInput): ADFProspectBuilder<S> {
    this._provider = input;
    return this as any;
  }

  /** Override the request date. Defaults to now when not set. */
  requestDate(date: Date | string): ADFProspectBuilder<S> {
    this._requestDate = date;
    return this as any;
  }

  /** Mark this as a resent lead. Defaults to "new". */
  status(s: ProspectStatus): ADFProspectBuilder<S> {
    this._status = s;
    return this as any;
  }

  // --------------------------------------------------------
  // Terminal methods — only available once all required fields are set.
  // --------------------------------------------------------

  /** Build and return the typed {@link ADFProspect} object. */
  build(this: ADFProspectBuilder<ProspectReady>): ADFProspect {
    if (this._vehicles.length === 0) {
      throw new Error("ADFProspectBuilder: at least one vehicle is required");
    }
    if (!this._customer) {
      throw new Error("ADFProspectBuilder: customer() is required");
    }
    if (!this._vendor) {
      throw new Error("ADFProspectBuilder: vendor() is required");
    }
    return buildProspect({
      requestDate: this._requestDate,
      vehicle: this._vehicles,
      customer: this._customer,
      vendor: this._vendor,
      provider: this._provider,
      status: this._status,
    });
  }

  /**
   * Build and return the ADF XML as a string.
   *
   * Use this when your HTTP client or email library takes a raw string body.
   */
  string(this: ADFProspectBuilder<ProspectReady>): string {
    return toXMLString({ version: "1.0", prospects: [this.build()] });
  }

  /**
   * Build and return the ADF XML as a `Blob` with `Content-Type: application/xml`.
   *
   * The Blob can be used:
   * - As a `fetch` body directly (the MIME type is carried automatically)
   * - As an email attachment payload (call `.arrayBuffer()` or `.text()` as needed)
   * - With any library that accepts `Blob` or `BodyInit`
   *
   * @example
   * ```ts
   * // fetch — no need to set Content-Type manually
   * await fetch(url, { method: 'POST', body: builder.xml() });
   *
   * // nodemailer attachment
   * const buf = Buffer.from(await builder.xml().arrayBuffer());
   * transporter.sendMail({ attachments: [{ filename: 'lead.xml', content: buf }] });
   * ```
   */
  xml(this: ADFProspectBuilder<ProspectReady>): Blob {
    return toXMLBlob({ version: "1.0", prospects: [this.build()] });
  }
}

// ============================================================
// ADFBuilder
// Fluent builder for a full ADF document (supports multi-prospect).
// ============================================================

/**
 * Fluent builder for a full ADF document.
 * Supports multiple prospects and all document-level options.
 *
 * @example
 * ```ts
 * const xml = new ADFBuilder()
 *   .prospect(p => p
 *     .vehicle({ year: 2024, make: 'Honda', model: 'CR-V' })
 *     .customer({ firstName: 'Alex', lastName: 'Park', email: 'alex@email.com' })
 *     .vendor({ name: 'Metro Honda', email: 'internet@metrohonda.com' })
 *   )
 *   .string();
 * ```
 */
export class ADFBuilder {
  private _prospects: ADFProspect[] = [];
  private _version = "1.0";

  /** Set the ADF spec version. Defaults to "1.0". */
  version(v: string): this {
    this._version = v;
    return this;
  }

  /**
   * Add a prospect (lead) to the document.
   *
   * Accepts either a {@link ProspectInput} object or a callback that
   * receives an {@link ADFProspectBuilder} and returns it after configuration.
   *
   * @example
   * ```ts
   * // Object form
   * builder.prospect({ vehicle: {...}, customer: {...}, vendor: {...} })
   *
   * // Callback / builder form
   * builder.prospect(p => p
   *   .vehicle({ year: 2024, make: 'Ford', model: 'F-150' })
   *   .customer({ firstName: 'Sam', email: 's@example.com' })
   *   .vendor({ name: 'City Ford' })
   * )
   * ```
   */
  prospect(
    input:
      | ProspectInput
      | ((builder: ADFProspectBuilder) => ADFProspectBuilder<ProspectReady>),
  ): this {
    if (typeof input === "function") {
      this._prospects.push(input(new ADFProspectBuilder()).build());
    } else {
      this._prospects.push(buildProspect(input));
    }
    return this;
  }

  // --------------------------------------------------------
  // Terminal methods
  // --------------------------------------------------------

  /** Build and return the typed {@link ADFDocument} object. */
  build(): ADFDocument {
    if (this._prospects.length === 0) {
      throw new Error("ADFBuilder: at least one prospect() is required");
    }
    return { version: this._version, prospects: this._prospects };
  }

  /**
   * Build and return the ADF XML as a string.
   *
   * Suitable as an HTTP request body with any framework, or for storing
   * the XML to send later.
   */
  string(): string {
    return toXMLString(this.build());
  }

  /**
   * Build and return the ADF XML as a `Blob` with `Content-Type: application/xml`.
   *
   * Accepted as-is by `fetch`, `Request`, and most HTTP/email libraries.
   *
   * @example
   * ```ts
   * await fetch(dealerEndpoint, { method: 'POST', body: builder.xml() });
   * ```
   */
  xml(): Blob {
    return toXMLBlob(this.build());
  }
}

// ============================================================
// One-shot factory functions (for simple, single-call use)
// ============================================================

/** Generate ADF XML for a single lead in one call. Returns an XML string. */
export function generateProspect(input: ProspectInput): string {
  return toXMLString({ version: "1.0", prospects: [buildProspect(input)] });
}

/** Generate ADF XML for a full document (one or more leads). Returns an XML string. */
export function generateADF(input: ADFInput): string {
  return toXMLString(buildDocument(input));
}
