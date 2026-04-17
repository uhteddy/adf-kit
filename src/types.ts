// ============================================================
// ADF 1.0 — Auto-lead Data Format Type Definitions
// Spec: https://adfxml.info/adf_spec.pdf
// ============================================================

import type { CurrencyCode } from 'currency-codes-ts/dist/types';
import type { Alpha2Code } from 'i18n-iso-countries';
import type { ISO8601DateTime, ISO8601Date } from './iso8601.ts';
export type { CurrencyCode, Alpha2Code, ISO8601DateTime, ISO8601Date };

// ----------------------------------------------------------
// Enumeration literal types
// ----------------------------------------------------------

export type ProspectStatus = 'new' | 'resend';

export type VehicleInterest =
  | 'buy'
  | 'lease'
  | 'sell'
  | 'trade-in'
  | 'test-drive';

export type VehicleStatus = 'new' | 'used';

export type OdometerStatus =
  | 'unknown'
  | 'rolledover'
  | 'replaced'
  | 'original';

export type OdometerUnits = 'km' | 'mi';

export type VehicleCondition =
  | 'excellent'
  | 'good'
  | 'fair'
  | 'poor'
  | 'unknown';

export type PriceType =
  | 'quote'
  | 'offer'
  | 'msrp'
  | 'invoice'
  | 'call'
  | 'appraisal'
  | 'asking';

export type PriceDelta = 'absolute' | 'relative' | 'percentage';

export type PriceRelativeTo = 'msrp' | 'invoice';

/** Free-text in practice; spec lists cash / finance / lease */
export type FinanceMethod = 'cash' | 'finance' | 'lease' | (string & {});

export type AmountType = 'downpayment' | 'monthly' | 'total';

export type AmountLimit = 'maximum' | 'minimum' | 'exact';

export type BalanceType = 'finance' | 'residual';

export type NamePart = 'surname' | 'first' | 'middle' | 'last' | 'full';

export type NameType = 'business' | 'individual';

export type PhoneType = 'voice' | 'fax' | 'cellphone' | 'pager';

export type PhoneTime =
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'nopreference'
  | 'day';

export type AddressType = 'work' | 'home' | 'delivery';

// ----------------------------------------------------------
// Shared structural types
// ----------------------------------------------------------

/**
 * Tracks provenance of an entity across systems.
 * Multiple ids may exist — each with a different source.
 */
export interface ADFId {
  /** The identifier value */
  value: string;
  /** Ordinal tracking the history of this datum across systems */
  sequence?: number;
  /** Name of the system that created this id (required by spec) */
  source?: string;
}

/** A single name segment (first, last, full, etc.) */
export interface ADFName {
  value: string;
  part: NamePart;
  type: NameType;
}

/** An email address, optionally marked as preferred contact */
export interface ADFEmail {
  value: string;
  preferredContact: boolean;
}

/** A phone number with type and preferred-time metadata */
export interface ADFPhone {
  value: string;
  type: PhoneType;
  time: PhoneTime;
  preferredContact: boolean;
}

/** One line of a street address */
export interface ADFStreet {
  value: string;
  /** Line number (1–5) */
  line?: string;
}

/** A mailing / physical address */
export interface ADFAddress {
  streets: ADFStreet[];
  apartment?: string;
  city?: string;
  /** State or province; 2-char code recommended for N. America */
  regionCode?: string;
  /** Post / ZIP code */
  postalCode?: string;
  /** ISO 3166-1 alpha-2 country code */
  country?: Alpha2Code;
  type?: AddressType;
}

/** Contact information block (shared by customer, vendor, provider) */
export interface ADFContact {
  /** At least one name required */
  names: ADFName[];
  /** At least email or phone required */
  emails: ADFEmail[];
  /** At least email or phone required */
  phones: ADFPhone[];
  address?: ADFAddress;
  /** Indicates this is the primary contact when multiple exist */
  primaryContact: boolean;
}

// ----------------------------------------------------------
// Vehicle sub-types
// ----------------------------------------------------------

export interface ADFOdometer {
  value: number;
  status?: OdometerStatus;
  units?: OdometerUnits;
}

export interface ADFColorCombination {
  interiorColor?: string;
  exteriorColor?: string;
  /** 1 = most preferred; higher numbers = less preferred */
  preference?: number;
}

export interface ADFImageTag {
  /** URL of the image */
  url: string;
  width?: string;
  height?: string;
  altText?: string;
}

/**
 * A price value with optional currency, delta, and source metadata.
 * Delta + relativeTo express a price relative to another basis:
 *   e.g. type="quote" delta="percentage" relativeTo="invoice" value=2
 *   means "2% above invoice price".
 */
export interface ADFPrice {
  value: number;
  type: PriceType;
  /** ISO 4217 currency code */
  currency?: CurrencyCode;
  delta?: PriceDelta;
  relativeTo?: PriceRelativeTo;
  /** Source of price data, e.g. "Kelley Blue Book" */
  source?: string;
}

/** A finance payment amount */
export interface ADFAmount {
  value: number;
  type: AmountType;
  limit: AmountLimit;
  /** ISO 4217 currency code */
  currency?: CurrencyCode;
}

/** Remaining balance on a trade-in or lease */
export interface ADFBalance {
  value: number;
  type: BalanceType;
  /** ISO 4217 currency code */
  currency?: CurrencyCode;
}

/** Financing details associated with a vehicle */
export interface ADFFinance {
  method: FinanceMethod;
  amounts: ADFAmount[];
  balance?: ADFBalance;
}

/** An individual vehicle option/package */
export interface ADFOption {
  optionName: string;
  manufacturerCode?: string;
  stock?: string;
  /**
   * Importance to the customer: +100 = essential to have,
   * -100 = essential NOT to have, 0 = don't care.
   */
  weighting?: number;
  price?: ADFPrice;
}

// ----------------------------------------------------------
// Top-level entity types
// ----------------------------------------------------------

/** Describes a vehicle the customer is interested in */
export interface ADFVehicle {
  ids: ADFId[];
  /** Model year */
  year: number;
  make: string;
  model: string;
  vin?: string;
  /** Dealer stock number */
  stock?: string;
  trim?: string;
  doors?: number;
  /** Generic body style: SUV, Sedan, Coupe, etc. */
  bodyStyle?: string;
  /** Usually "A" (Automatic) or "M" (Manual) */
  transmission?: string;
  odometer?: ADFOdometer;
  condition?: VehicleCondition;
  colorCombinations: ADFColorCombination[];
  imageTag?: ADFImageTag;
  price?: ADFPrice;
  priceComments?: string;
  options: ADFOption[];
  finance?: ADFFinance;
  comments?: string;
  interest: VehicleInterest;
  status: VehicleStatus;
}

/** Customer's intended purchase timeframe */
export interface ADFTimeFrame {
  description?: string;
  /** ISO 8601 date */
  earliestDate?: ISO8601Date;
  /** ISO 8601 date */
  latestDate?: ISO8601Date;
}

/** The buyer / prospect */
export interface ADFCustomer {
  contact: ADFContact;
  ids: ADFId[];
  timeFrame?: ADFTimeFrame;
  comments?: string;
}

/** The dealership or selling entity */
export interface ADFVendor {
  ids: ADFId[];
  vendorName: string;
  url?: string;
  contact: ADFContact;
}

/**
 * The lead source / service provider that originated the lead
 * (e.g. CarPoint, Autoweb, Cobalt). Optional in a prospect.
 */
export interface ADFProvider {
  ids: ADFId[];
  /** Name of the service provider */
  name: ADFName;
  /** Name of the specific service within the provider */
  service?: string;
  url?: string;
  /** General reply address for lead-related issues */
  email?: string;
  /** Provider contact phone */
  phone?: string;
  contact?: ADFContact;
}

/** A single automotive lead */
export interface ADFProspect {
  ids: ADFId[];
  /** ISO 8601 date-time when the lead was created */
  requestDate: ISO8601DateTime;
  /** At least one vehicle required */
  vehicles: ADFVehicle[];
  customer: ADFCustomer;
  vendor: ADFVendor;
  provider?: ADFProvider;
  status: ProspectStatus;
}

/** The root ADF document, potentially containing multiple leads */
export interface ADFDocument {
  /** ADF specification version (e.g. "1.0") */
  version: string;
  /** One or more prospects (leads) */
  prospects: ADFProspect[];
}
