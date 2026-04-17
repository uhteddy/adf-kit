// ============================================================
// ADF 1.0 — XML Parser
// Converts an ADF XML string into a fully-typed ADFDocument.
// ============================================================

import { XMLParser } from 'fast-xml-parser';
import type { CurrencyCode } from 'currency-codes-ts/dist/types';
import type { Alpha2Code } from 'i18n-iso-countries';
import { coerceDateTime, coerceDate } from './iso8601.ts';
import type { ISO8601DateTime, ISO8601Date } from './iso8601.ts';
import { ADFParseError } from './errors.ts';
import type {
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
  ProspectStatus,
  VehicleInterest,
  VehicleStatus,
  OdometerStatus,
  OdometerUnits,
  VehicleCondition,
  PriceType,
  PriceDelta,
  PriceRelativeTo,
  AmountType,
  AmountLimit,
  BalanceType,
  NamePart,
  NameType,
  PhoneType,
  PhoneTime,
  AddressType,
} from './types.ts';

// ----------------------------------------------------------
// Parser configuration
// ----------------------------------------------------------

// These elements may appear multiple times in a document;
// fast-xml-parser will always return them as arrays.
const ALWAYS_ARRAY: ReadonlySet<string> = new Set([
  'prospect',
  'vehicle',
  'id',
  'name',
  'phone',
  'email',
  'colorcombination',
  'option',
  'amount',
  'street',
  'contact',
  'address',
]);

function buildXMLParser(): XMLParser {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    // Keep all values as strings; we parse numbers explicitly.
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    processEntities: true,
    isArray: (name) => ALWAYS_ARRAY.has(name),
  });
}

// ----------------------------------------------------------
// Low-level node helpers
// ----------------------------------------------------------

type RawNode = Record<string, unknown>;

/** Extract the text content of a node (handles both plain strings and mixed nodes). */
function text(node: unknown): string {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string') return node.trim();
  if (typeof node === 'number' || typeof node === 'boolean') return String(node);
  if (typeof node === 'object') {
    const n = node as RawNode;
    if ('#text' in n) return String(n['#text'] ?? '').trim();
  }
  return '';
}

/** Read a string attribute from a node; returns undefined when absent. */
function attr(node: unknown, name: string): string | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const val = (node as RawNode)[`@_${name}`];
  if (val === undefined || val === null) return undefined;
  return String(val).trim() || undefined;
}

/** Read an integer attribute from a node. */
function attrInt(node: unknown, name: string): number | undefined {
  const s = attr(node, name);
  if (s === undefined) return undefined;
  const n = parseInt(s, 10);
  return isNaN(n) ? undefined : n;
}

/** Read a named child element from a parent node. */
function child(parent: unknown, name: string): unknown {
  if (!parent || typeof parent !== 'object') return undefined;
  return (parent as RawNode)[name];
}

/**
 * Read a named child as an array.
 * Because ALWAYS_ARRAY causes matching tags to always be arrays,
 * this will return [] for missing, or the array as-is.
 * For elements NOT in ALWAYS_ARRAY it wraps single values.
 */
function children(parent: unknown, name: string): unknown[] {
  const val = child(parent, name);
  if (val === undefined || val === null) return [];
  if (Array.isArray(val)) return val;
  return [val];
}

/** Read the text content of a named child element. */
function childText(parent: unknown, name: string): string | undefined {
  const c = child(parent, name);
  if (c === undefined || c === null) return undefined;
  const t = text(c);
  return t === '' ? undefined : t;
}

/** Parse a float from a node's text content. */
function nodeFloat(node: unknown): number | undefined {
  const s = text(node);
  if (s === '') return undefined;
  const n = parseFloat(s);
  return isNaN(n) ? undefined : n;
}

// ----------------------------------------------------------
// Enum casting helpers
// ----------------------------------------------------------

function castEnum<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (value !== undefined && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return fallback;
}

/**
 * Cast a raw attribute string to CurrencyCode.
 * The parser trusts the input; semantic validation happens in validate().
 */
function parseCurrency(value: string | undefined): CurrencyCode | undefined {
  if (!value) return undefined;
  return value as CurrencyCode;
}

/** Cast a raw element string to Alpha2Code (trust-and-cast, validate() checks). */
function parseCountry(value: string | undefined): Alpha2Code | undefined {
  if (!value) return undefined;
  return value as Alpha2Code;
}

/** Coerce an optional raw string to ISO8601Date (trust-and-cast). */
function coerceDateMaybe(value: string | undefined): ISO8601Date | undefined {
  if (!value) return undefined;
  return coerceDate(value);
}

function castEnumMaybe<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  if (value !== undefined && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return undefined;
}

// ----------------------------------------------------------
// Entity parsers
// ----------------------------------------------------------

function parseId(node: unknown): ADFId {
  return {
    value: text(node),
    sequence: attrInt(node, 'sequence'),
    source: attr(node, 'source'),
  };
}

function parseIds(parent: unknown): ADFId[] {
  return children(parent, 'id').map(parseId);
}

const NAME_PARTS: readonly NamePart[] = ['surname', 'first', 'middle', 'last', 'full'];
const NAME_TYPES: readonly NameType[] = ['business', 'individual'];

function parseName(node: unknown): ADFName {
  return {
    value: text(node),
    part: castEnum(attr(node, 'part'), NAME_PARTS, 'full'),
    type: castEnum(attr(node, 'type'), NAME_TYPES, 'individual'),
  };
}

function parseEmail(node: unknown): ADFEmail {
  return {
    value: text(node),
    preferredContact: attr(node, 'preferredcontact') === '1',
  };
}

const PHONE_TYPES: readonly PhoneType[] = ['voice', 'fax', 'cellphone', 'pager'];
const PHONE_TIMES: readonly PhoneTime[] = [
  'morning',
  'afternoon',
  'evening',
  'nopreference',
  'day',
];

function parsePhone(node: unknown): ADFPhone {
  return {
    value: text(node),
    type: castEnum(attr(node, 'type'), PHONE_TYPES, 'voice'),
    time: castEnum(attr(node, 'time'), PHONE_TIMES, 'nopreference'),
    preferredContact: attr(node, 'preferredcontact') === '1',
  };
}

function parseStreet(node: unknown): ADFStreet {
  return {
    value: text(node),
    line: attr(node, 'line'),
  };
}

const ADDRESS_TYPES: readonly AddressType[] = ['work', 'home', 'delivery'];

function parseAddress(node: unknown): ADFAddress {
  return {
    streets: children(node, 'street').map(parseStreet),
    apartment: childText(node, 'apartment'),
    city: childText(node, 'city'),
    regionCode: childText(node, 'regioncode'),
    postalCode: childText(node, 'postalcode'),
    country: parseCountry(childText(node, 'country')),
    type: castEnumMaybe(attr(node, 'type'), ADDRESS_TYPES),
  };
}

function parseContact(node: unknown, path: string): ADFContact {
  if (!node) throw new ADFParseError(`Missing required <contact> at ${path}`);

  const addressNodes = children(node, 'address');
  const address =
    addressNodes.length > 0 && addressNodes[0] !== undefined
      ? parseAddress(addressNodes[0])
      : undefined;

  return {
    names: children(node, 'name').map(parseName),
    emails: children(node, 'email').map(parseEmail),
    phones: children(node, 'phone').map(parsePhone),
    address,
    primaryContact: attr(node, 'primarycontact') === '1',
  };
}

const ODOMETER_STATUSES: readonly OdometerStatus[] = [
  'unknown',
  'rolledover',
  'replaced',
  'original',
];
const ODOMETER_UNITS: readonly OdometerUnits[] = ['km', 'mi'];

function parseOdometer(node: unknown): ADFOdometer | undefined {
  if (!node) return undefined;
  const value = nodeFloat(node);
  if (value === undefined) return undefined;
  return {
    value,
    status: castEnumMaybe(attr(node, 'status'), ODOMETER_STATUSES),
    units: castEnumMaybe(attr(node, 'units'), ODOMETER_UNITS),
  };
}

function parseColorCombination(node: unknown): ADFColorCombination {
  const prefText = childText(node, 'preference');
  const preference =
    prefText !== undefined ? parseInt(prefText, 10) : undefined;
  return {
    interiorColor: childText(node, 'interiorcolor'),
    exteriorColor: childText(node, 'exteriorcolor'),
    preference: preference !== undefined && !isNaN(preference) ? preference : undefined,
  };
}

function parseImageTag(node: unknown): ADFImageTag | undefined {
  if (!node) return undefined;
  return {
    url: text(node),
    width: attr(node, 'width'),
    height: attr(node, 'height'),
    altText: attr(node, 'alttext'),
  };
}

const PRICE_TYPES: readonly PriceType[] = [
  'quote',
  'offer',
  'msrp',
  'invoice',
  'call',
  'appraisal',
  'asking',
];
const PRICE_DELTAS: readonly PriceDelta[] = ['absolute', 'relative', 'percentage'];
const PRICE_REL: readonly PriceRelativeTo[] = ['msrp', 'invoice'];

function parsePrice(node: unknown): ADFPrice | undefined {
  if (!node) return undefined;
  const value = nodeFloat(node);
  if (value === undefined) return undefined;
  return {
    value,
    type: castEnum(attr(node, 'type'), PRICE_TYPES, 'quote'),
    currency: parseCurrency(attr(node, 'currency')),
    delta: castEnumMaybe(attr(node, 'delta'), PRICE_DELTAS),
    relativeTo: castEnumMaybe(attr(node, 'relativeto'), PRICE_REL),
    source: attr(node, 'source'),
  };
}

const AMOUNT_TYPES: readonly AmountType[] = ['downpayment', 'monthly', 'total'];
const AMOUNT_LIMITS: readonly AmountLimit[] = ['maximum', 'minimum', 'exact'];

function parseAmount(node: unknown): ADFAmount {
  return {
    value: nodeFloat(node) ?? 0,
    type: castEnum(attr(node, 'type'), AMOUNT_TYPES, 'total'),
    limit: castEnum(attr(node, 'limit'), AMOUNT_LIMITS, 'maximum'),
    currency: parseCurrency(attr(node, 'currency')),
  };
}

const BALANCE_TYPES: readonly BalanceType[] = ['finance', 'residual'];

function parseBalance(node: unknown): ADFBalance | undefined {
  if (!node) return undefined;
  const value = nodeFloat(node);
  if (value === undefined) return undefined;
  return {
    value,
    type: castEnum(attr(node, 'type'), BALANCE_TYPES, 'finance'),
    currency: parseCurrency(attr(node, 'currency')),
  };
}

function parseFinance(node: unknown): ADFFinance | undefined {
  if (!node) return undefined;
  return {
    method: childText(node, 'method') ?? '',
    amounts: children(node, 'amount').map(parseAmount),
    balance: parseBalance(child(node, 'balance')),
  };
}

function parseOption(node: unknown): ADFOption {
  const weightingText = childText(node, 'weighting');
  const weighting =
    weightingText !== undefined ? parseInt(weightingText, 10) : undefined;
  return {
    optionName: childText(node, 'optionname') ?? '',
    manufacturerCode: childText(node, 'manufacturercode'),
    stock: childText(node, 'stock'),
    weighting: weighting !== undefined && !isNaN(weighting) ? weighting : undefined,
    price: parsePrice(child(node, 'price')),
  };
}

const VEHICLE_INTERESTS: readonly VehicleInterest[] = [
  'buy',
  'lease',
  'sell',
  'trade-in',
  'test-drive',
];
const VEHICLE_STATUSES: readonly VehicleStatus[] = ['new', 'used'];
const VEHICLE_CONDITIONS: readonly VehicleCondition[] = [
  'excellent',
  'good',
  'fair',
  'poor',
  'unknown',
];

function parseVehicle(node: unknown, path: string): ADFVehicle {
  const yearText = childText(node, 'year') ?? '0';
  const doorsText = childText(node, 'doors');

  return {
    ids: parseIds(node),
    year: parseInt(yearText, 10) || 0,
    make: childText(node, 'make') ?? '',
    model: childText(node, 'model') ?? '',
    vin: childText(node, 'vin'),
    stock: childText(node, 'stock'),
    trim: childText(node, 'trim'),
    doors:
      doorsText !== undefined
        ? parseInt(doorsText, 10) || undefined
        : undefined,
    bodyStyle: childText(node, 'bodystyle'),
    transmission: childText(node, 'transmission'),
    odometer: parseOdometer(child(node, 'odometer')),
    condition: castEnumMaybe(childText(node, 'condition'), VEHICLE_CONDITIONS),
    colorCombinations: children(node, 'colorcombination').map(
      parseColorCombination,
    ),
    imageTag: parseImageTag(child(node, 'imagetag')),
    price: parsePrice(child(node, 'price')),
    priceComments: childText(node, 'pricecomments'),
    options: children(node, 'option').map(parseOption),
    finance: parseFinance(child(node, 'finance')),
    comments: childText(node, 'comments'),
    interest: castEnum(attr(node, 'interest'), VEHICLE_INTERESTS, 'buy'),
    status: castEnum(attr(node, 'status'), VEHICLE_STATUSES, 'new'),
  };
}

function parseTimeFrame(node: unknown): ADFTimeFrame | undefined {
  if (!node) return undefined;
  return {
    description: childText(node, 'description'),
    earliestDate: coerceDateMaybe(childText(node, 'earliestdate')),
    latestDate: coerceDateMaybe(childText(node, 'latestdate')),
  };
}

function parseCustomer(node: unknown, path: string): ADFCustomer {
  if (!node) throw new ADFParseError(`Missing required <customer> at ${path}`);

  const contactNodes = children(node, 'contact');
  const contactNode = contactNodes[0] ?? child(node, 'contact');
  const contact = parseContact(contactNode, `${path}.contact`);

  return {
    contact,
    ids: parseIds(node),
    timeFrame: parseTimeFrame(child(node, 'timeframe')),
    comments: childText(node, 'comments'),
  };
}

function parseVendor(node: unknown, path: string): ADFVendor {
  if (!node) throw new ADFParseError(`Missing required <vendor> at ${path}`);

  const contactNodes = children(node, 'contact');
  const contactNode = contactNodes[0] ?? child(node, 'contact');
  if (!contactNode) {
    throw new ADFParseError(`Missing required <contact> inside <vendor> at ${path}`);
  }

  return {
    ids: parseIds(node),
    vendorName: childText(node, 'vendorname') ?? '',
    url: childText(node, 'url'),
    contact: parseContact(contactNode, `${path}.contact`),
  };
}

function parseProvider(node: unknown, path: string): ADFProvider | undefined {
  if (!node) return undefined;

  // Provider's top-level <name> may be an array due to ALWAYS_ARRAY
  const nameNodes = children(node, 'name');
  const nameNode = nameNodes[0] ?? child(node, 'name');
  const name = parseName(nameNode);

  const contactNodes = children(node, 'contact');
  const contactNode = contactNodes[0];

  return {
    ids: parseIds(node),
    name,
    service: childText(node, 'service'),
    url: childText(node, 'url'),
    email: childText(node, 'email'),
    phone: childText(node, 'phone'),
    contact: contactNode ? parseContact(contactNode, `${path}.contact`) : undefined,
  };
}

const PROSPECT_STATUSES: readonly ProspectStatus[] = ['new', 'resend'];

function parseProspect(node: unknown, index: number): ADFProspect {
  const path = `prospects[${index}]`;

  const vehicleNodes = children(node, 'vehicle');
  if (vehicleNodes.length === 0) {
    throw new ADFParseError(`${path}: at least one <vehicle> is required`);
  }

  const rawRequestDate = childText(node, 'requestdate');
  if (!rawRequestDate) {
    throw new ADFParseError(`${path}: <requestdate> is required`);
  }
  const requestDate = coerceDateTime(rawRequestDate);

  return {
    ids: parseIds(node),
    requestDate,
    vehicles: vehicleNodes.map((v, i) => parseVehicle(v, `${path}.vehicles[${i}]`)),
    customer: parseCustomer(child(node, 'customer'), `${path}.customer`),
    vendor: parseVendor(child(node, 'vendor'), `${path}.vendor`),
    provider: parseProvider(child(node, 'provider'), `${path}.provider`),
    status: castEnum(attr(node, 'status'), PROSPECT_STATUSES, 'new'),
  };
}

// ----------------------------------------------------------
// XML preprocessing
// ----------------------------------------------------------

interface PreprocessResult {
  xml: string;
  adfVersion: string;
}

/**
 * Strips the non-standard `<?ADF version "1.0"?>` processing instruction
 * and normalises the `<?XML VERSION "1.0"?>` declaration to lowercase.
 */
function preprocessXML(raw: string): PreprocessResult {
  let adfVersion = '1.0';

  // Capture ADF version from non-standard PI, case-insensitively
  let xml = raw.replace(
    /<\?[Aa][Dd][Ff]\s+[Vv][Ee][Rr][Ss][Ii][Oo][Nn]\s+"([^"]+)"\s*\?>/g,
    (_, v: string) => {
      adfVersion = v;
      return '';
    },
  );

  // Normalise non-standard uppercase <?XML VERSION "1.0"?> → <?xml version="1.0"?>
  xml = xml.replace(
    /<\?[Xx][Mm][Ll]\s+[Vv][Ee][Rr][Ss][Ii][Oo][Nn]\s+"([^"]+)"\s*\?>/g,
    (_, v: string) => `<?xml version="${v}"?>`,
  );

  return { xml: xml.trim(), adfVersion };
}

// ----------------------------------------------------------
// Public API
// ----------------------------------------------------------

/**
 * Parse an ADF XML string into a typed {@link ADFDocument}.
 *
 * @throws {ADFParseError} if the XML is malformed or required ADF elements are missing.
 */
export function parse(xmlString: string): ADFDocument {
  const { xml, adfVersion } = preprocessXML(xmlString);

  const parser = buildXMLParser();
  let raw: unknown;

  try {
    raw = parser.parse(xml);
  } catch (err) {
    throw new ADFParseError(
      `XML parse failure: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }

  const adfNode = child(raw, 'adf');
  if (!adfNode) {
    throw new ADFParseError('Root <adf> element not found');
  }

  const prospectNodes = children(adfNode, 'prospect');
  if (prospectNodes.length === 0) {
    throw new ADFParseError('<adf> must contain at least one <prospect>');
  }

  return {
    version: adfVersion,
    prospects: prospectNodes.map((p, i) => parseProspect(p, i)),
  };
}
