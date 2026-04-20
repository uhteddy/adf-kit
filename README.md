# adf-kit

A TypeScript library for parsing, validating, generating, and serializing **Auto-lead Data Format (ADF) 1.0** documents — the XML standard used across automotive CRMs, dealer management systems, and lead aggregators.

Zero runtime dependencies when installed from the distributed bundle.

---

## Installation

```bash
bun add @uhteddy/adf-kit
# or
npm install @uhteddy/adf-kit
```

---

## API Overview

| Export | Description |
|---|---|
| `ADFparse(xml)` | Parse an ADF XML string into a typed `ADFDocument` |
| `ADFvalidate(doc)` | Validate a document against the ADF 1.0 spec — returns errors/warnings without throwing |
| `ADFserialize(doc)` | Serialize a typed `ADFDocument` back to ADF XML |
| `ADFProspectBuilder` | Fluent builder for a single lead — call `.string()` or `.xml()` to get output |
| `ADFBuilder` | Fluent builder for a multi-prospect document |
| `generateProspect(input)` | One-shot: convert a `ProspectInput` object directly to XML |
| `generateADF(input)` | One-shot: convert an `ADFInput` object directly to XML |
| `buildProspect(input)` | Convert `ProspectInput` → `ADFProspect` without serializing |
| `buildDocument(input)` | Convert `ADFInput` → `ADFDocument` without serializing |

---

## Generating Leads

### New car purchase lead

```ts
import { ADFProspectBuilder } from '@uhteddy/adf-kit';

const xml = new ADFProspectBuilder()
  .vehicle({
    year: 2025,
    make: 'Toyota',
    model: 'Camry',
    trim: 'XSE',
    interest: 'buy',
    status: 'new',
    price: 32_500,
    colors: [{ exterior: 'Midnight Black', interior: 'Black' }],
  })
  .customer({
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@example.com',
    phone: '555-867-5309',
    address: { city: 'Austin', regionCode: 'TX', postalCode: '78701' },
    timeFrame: { description: 'Within 30 days', earliest: '2025-05-01', latest: '2025-05-31' },
  })
  .vendor({ name: 'Sunrise Toyota', email: 'leads@sunrisetoyota.com', phone: '512-555-0100' })
  .provider({ name: 'AutoTrader', service: 'New Car Search', url: 'https://autotrader.com' })
  .string();
```

### Used car purchase lead

```ts
const xml = new ADFProspectBuilder()
  .vehicle({
    year: 2021,
    make: 'Ford',
    model: 'F-150',
    trim: 'XLT',
    vin: '1FTFW1E80MFA00001',
    stock: 'P22481',
    interest: 'buy',
    status: 'used',
    mileage: { value: 41_200, units: 'mi', status: 'original' },
    price: { value: 38_900, type: 'asking' },
    condition: 'good',
  })
  .customer({
    firstName: 'Carlos',
    lastName: 'Rivera',
    email: 'carlos@example.com',
    phone: [
      { number: '512-555-0191', type: 'cellphone', preferred: true },
      { number: '512-555-0100', type: 'voice' },
    ],
  })
  .vendor({ name: 'Capital City Ford', email: 'internet@capitalcityford.com' })
  .string();
```

### Lease lead

```ts
const xml = new ADFProspectBuilder()
  .vehicle({
    year: 2025,
    make: 'BMW',
    model: '3 Series',
    trim: '330i',
    interest: 'lease',
    status: 'new',
    finance: {
      method: 'lease',
      monthlyPayment: { value: 550, limit: 'maximum' },
      downPayment: { value: 3_000, limit: 'maximum' },
    },
  })
  .customer({
    firstName: 'Priya',
    lastName: 'Patel',
    email: 'priya@example.com',
    timeFrame: 'Within 2 weeks',
  })
  .vendor({ name: 'Downtown BMW', email: 'leads@downtownbmw.com' })
  .string();
```

### Trade-in appraisal lead

```ts
const xml = new ADFProspectBuilder()
  .vehicle({
    year: 2019,
    make: 'Honda',
    model: 'CR-V',
    trim: 'EX',
    vin: '2HKRW2H55KH600001',
    interest: 'trade-in',
    status: 'used',
    mileage: 78_400,
    condition: 'good',
    price: { value: 22_000, type: 'appraisal' },
  })
  .customer({
    firstName: 'Marcus',
    lastName: 'Johnson',
    email: 'marcus.j@example.com',
    comments: 'Interested in trading this in toward a new SUV.',
  })
  .vendor({ name: 'Greenfield Honda', email: 'appraisals@greenfieldhonda.com' })
  .string();
```

### Lead with multiple vehicles of interest

```ts
import { ADFBuilder } from '@uhteddy/adf-kit';

const xml = new ADFBuilder()
  .prospect(p => p
    .vehicle({ year: 2025, make: 'Honda', model: 'CR-V', interest: 'buy', status: 'new' })
    .vehicle({ year: 2025, make: 'Toyota', model: 'RAV4', interest: 'buy', status: 'new' })
    .vehicle({ year: 2025, make: 'Mazda', model: 'CX-5', interest: 'buy', status: 'new' })
    .customer({ firstName: 'Sam', email: 'sam@example.com', timeFrame: 'Next month' })
    .vendor({ name: 'Metro Auto Group', email: 'leads@metroauto.com' })
  )
  .string();
```

### Test drive request

```ts
const xml = new ADFProspectBuilder()
  .vehicle({
    year: 2024,
    make: 'Rivian',
    model: 'R1T',
    interest: 'test-drive',
    status: 'new',
  })
  .customer({
    firstName: 'Alex',
    lastName: 'Chen',
    email: 'alex@example.com',
    phone: '415-555-0177',
    timeFrame: { description: 'This weekend if possible' },
  })
  .vendor({ name: 'Bay Area Rivian', email: 'reservations@barivian.com' })
  .string();
```

---

## Parsing Leads

### Basic parse

```ts
import { ADFparse } from '@uhteddy/adf-kit';

const doc = ADFparse(xmlString);
// doc.prospects[0].vehicles[0].make  → "Toyota"
// doc.prospects[0].customer.contact.emails[0].value  → "jane@example.com"
```

### Parse + validate

```ts
import { ADFparse, ADFvalidate } from '@uhteddy/adf-kit';

let doc;
try {
  doc = parse(xmlString);
} catch (err) {
  // ADFParseError — malformed XML or missing required elements
  console.error('Could not parse ADF:', err.message);
  process.exit(1);
}

const result = validate(doc);
if (!result.valid) {
  for (const issue of result.errors) {
    console.error(`[${issue.path}] ${issue.message}`);
  }
}
for (const warn of result.warnings) {
  console.warn(`[${warn.path}] ${warn.message}`);
}
```

### Extracting lead data

```ts
import { ADFparse } from '@uhteddy/adf-kit';

const doc = ADFparse(xmlString);

for (const prospect of doc.prospects) {
  const { customer, vendor, vehicles, requestDate, status } = prospect;

  const name = customer.contact.names.find(n => n.part === 'first')?.value;
  const email = customer.contact.emails[0]?.value;
  const phone = customer.contact.phones[0]?.value;

  for (const vehicle of vehicles) {
    console.log(`${requestDate} | ${status} | ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
    console.log(`  Customer: ${name} <${email}> ${phone}`);
    console.log(`  Dealer:   ${vendor.vendorName}`);
  }
}
```

### Round-trip: parse → modify → serialize

```ts
import { ADFparse, ADFserialize } from '@uhteddy/adf-kit';

const doc = parse(inboundXml);
doc.prospects[0].status = 'resend';
const updatedXml = ADFserialize(doc);
```

---

## Validation Reference

`ADFvalidate()` never throws. It returns:

```ts
{
  valid: boolean;
  errors: ValidationIssue[];    // spec violations
  warnings: ValidationIssue[];  // non-fatal issues
}
```

**Errors** (spec violations):
- Missing required fields: vehicle year/make/model, customer name, vendor name
- Customer or vendor contact has no email and no phone
- Address exceeds 5 street lines
- Option weighting outside −100 to +100

**Warnings** (flagged but not blocking):
- Invalid VIN format
- Vehicle year outside 1886–2100
- Malformed email address
- Invalid ISO 4217 currency code or ISO 3166-1 country code
- Malformed ISO 8601 date
- `earliestDate` is after `latestDate`
- Negative odometer or finance amounts
- Missing ID source attribute

---

## Type Reference

```
ADFDocument
└── prospects: ADFProspect[]
    ├── requestDate: ISO8601DateTime
    ├── status: 'new' | 'resend'
    ├── ids: ADFId[]
    ├── vehicles: ADFVehicle[]
    │   ├── year, make, model, vin, stock, trim, bodyStyle …
    │   ├── interest: 'buy' | 'lease' | 'sell' | 'trade-in' | 'test-drive'
    │   ├── status: 'new' | 'used'
    │   ├── condition: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown'
    │   ├── odometer: ADFOdometer  { value, units: 'mi'|'km', status }
    │   ├── price: ADFPrice        { value, type, currency, delta, relativeTo }
    │   ├── colorCombinations: ADFColorCombination[]
    │   ├── options: ADFOption[]
    │   └── finance: ADFFinance    { method, amounts, balance }
    ├── customer: ADFCustomer
    │   ├── contact: ADFContact    (names, emails, phones, address)
    │   └── timeFrame: ADFTimeFrame { description, earliestDate, latestDate }
    ├── vendor: ADFVendor
    │   ├── vendorName: string
    │   └── contact: ADFContact
    └── provider?: ADFProvider
        └── name, service, url, email, phone, contact
```

Full TypeScript types for all nodes are exported from the package and are available for use in your own code:

```ts
import type {
  ADFDocument, ADFProspect, ADFVehicle, ADFCustomer, ADFVendor,
  ADFProvider, ADFContact, ADFPrice, ADFFinance, ADFTimeFrame,
  // … and more
} from 'adf-kit';
```

---

## Spec

ADF 1.0 specification: [adfxml.info/adf_spec.pdf](https://adfxml.info/adf_spec.pdf)
