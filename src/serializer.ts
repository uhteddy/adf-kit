// ============================================================
// ADF 1.0 — XML Serializer
// Converts a typed ADFDocument back into a valid ADF XML string.
// ============================================================

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
} from './types.ts';

// ----------------------------------------------------------
// XML string builder
// ----------------------------------------------------------

class XMLWriter {
  private readonly lines: string[] = [];
  private depth = 0;

  private pad(): string {
    return '  '.repeat(this.depth);
  }

  /** Escape text content for XML */
  private escapeText(value: string | number): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /** Escape attribute value for XML */
  private escapeAttr(value: string | number): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private buildAttrString(
    attrs: Record<string, string | number | undefined>,
  ): string {
    return Object.entries(attrs)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => ` ${k}="${this.escapeAttr(v!)}"`)
      .join('');
  }

  /** Emit a self-contained element: <tag attrs>text</tag> */
  leaf(
    tag: string,
    content: string | number,
    attrs: Record<string, string | number | undefined> = {},
  ): this {
    this.lines.push(
      `${this.pad()}<${tag}${this.buildAttrString(attrs)}>${this.escapeText(content)}</${tag}>`,
    );
    return this;
  }

  /** Emit optional leaf — skipped when content is undefined */
  leafMaybe(
    tag: string,
    content: string | number | undefined,
    attrs: Record<string, string | number | undefined> = {},
  ): this {
    if (content !== undefined) this.leaf(tag, content, attrs);
    return this;
  }

  /** Open a container element */
  open(
    tag: string,
    attrs: Record<string, string | number | undefined> = {},
  ): this {
    this.lines.push(`${this.pad()}<${tag}${this.buildAttrString(attrs)}>`);
    this.depth++;
    return this;
  }

  /** Close a container element */
  close(tag: string): this {
    this.depth--;
    this.lines.push(`${this.pad()}</${tag}>`);
    return this;
  }

  /** Raw line (for declarations / PIs) */
  raw(line: string): this {
    this.lines.push(line);
    return this;
  }

  toString(): string {
    return this.lines.join('\n');
  }
}

// ----------------------------------------------------------
// Entity serializers
// ----------------------------------------------------------

function writeId(w: XMLWriter, id: ADFId): void {
  w.leaf('id', id.value, {
    sequence: id.sequence,
    source: id.source,
  });
}

function writeName(w: XMLWriter, name: ADFName): void {
  w.leaf('name', name.value, {
    part: name.part,
    type: name.type !== 'individual' ? name.type : undefined,
  });
}

function writeEmail(w: XMLWriter, email: ADFEmail): void {
  w.leaf('email', email.value, {
    preferredcontact: email.preferredContact ? '1' : '0',
  });
}

function writePhone(w: XMLWriter, phone: ADFPhone): void {
  w.leaf('phone', phone.value, {
    type: phone.type !== 'voice' ? phone.type : undefined,
    time: phone.time !== 'nopreference' ? phone.time : undefined,
    preferredcontact: phone.preferredContact ? '1' : undefined,
  });
}

function writeStreet(w: XMLWriter, street: ADFStreet): void {
  w.leaf('street', street.value, { line: street.line });
}

function writeAddress(w: XMLWriter, address: ADFAddress): void {
  w.open('address', { type: address.type });
  for (const s of address.streets) writeStreet(w, s);
  w.leafMaybe('apartment', address.apartment);
  w.leafMaybe('city', address.city);
  w.leafMaybe('regioncode', address.regionCode);
  w.leafMaybe('postalcode', address.postalCode);
  w.leafMaybe('country', address.country);
  w.close('address');
}

function writeContact(w: XMLWriter, contact: ADFContact): void {
  w.open('contact', {
    primarycontact: contact.primaryContact ? '1' : undefined,
  });
  for (const n of contact.names) writeName(w, n);
  for (const e of contact.emails) writeEmail(w, e);
  for (const p of contact.phones) writePhone(w, p);
  if (contact.address) writeAddress(w, contact.address);
  w.close('contact');
}

function writePrice(w: XMLWriter, price: ADFPrice): void {
  w.leaf('price', price.value, {
    type: price.type !== 'quote' ? price.type : undefined,
    currency: price.currency,
    delta: price.delta,
    relativeto: price.relativeTo,
    source: price.source,
  });
}

function writeOdometer(w: XMLWriter, odo: ADFOdometer): void {
  w.leaf('odometer', odo.value, {
    status: odo.status,
    units: odo.units,
  });
}

function writeColorCombination(w: XMLWriter, cc: ADFColorCombination): void {
  w.open('colorcombination');
  w.leafMaybe('interiorcolor', cc.interiorColor);
  w.leafMaybe('exteriorcolor', cc.exteriorColor);
  w.leafMaybe('preference', cc.preference);
  w.close('colorcombination');
}

function writeImageTag(w: XMLWriter, img: ADFImageTag): void {
  w.leaf('imagetag', img.url, {
    width: img.width,
    height: img.height,
    alttext: img.altText,
  });
}

function writeOption(w: XMLWriter, opt: ADFOption): void {
  w.open('option');
  w.leaf('optionname', opt.optionName);
  w.leafMaybe('manufacturercode', opt.manufacturerCode);
  w.leafMaybe('stock', opt.stock);
  w.leafMaybe('weighting', opt.weighting);
  if (opt.price) writePrice(w, opt.price);
  w.close('option');
}

function writeAmount(w: XMLWriter, amount: ADFAmount): void {
  w.leaf('amount', amount.value, {
    type: amount.type !== 'total' ? amount.type : undefined,
    limit: amount.limit !== 'maximum' ? amount.limit : undefined,
    currency: amount.currency,
  });
}

function writeBalance(w: XMLWriter, balance: ADFBalance): void {
  w.leaf('balance', balance.value, {
    type: balance.type !== 'finance' ? balance.type : undefined,
    currency: balance.currency,
  });
}

function writeFinance(w: XMLWriter, finance: ADFFinance): void {
  w.open('finance');
  w.leaf('method', finance.method);
  for (const a of finance.amounts) writeAmount(w, a);
  if (finance.balance) writeBalance(w, finance.balance);
  w.close('finance');
}

function writeVehicle(w: XMLWriter, vehicle: ADFVehicle): void {
  w.open('vehicle', {
    interest: vehicle.interest !== 'buy' ? vehicle.interest : undefined,
    status: vehicle.status !== 'new' ? vehicle.status : undefined,
  });
  for (const id of vehicle.ids) writeId(w, id);
  w.leaf('year', vehicle.year);
  w.leaf('make', vehicle.make);
  w.leaf('model', vehicle.model);
  w.leafMaybe('vin', vehicle.vin);
  w.leafMaybe('stock', vehicle.stock);
  w.leafMaybe('trim', vehicle.trim);
  w.leafMaybe('doors', vehicle.doors);
  w.leafMaybe('bodystyle', vehicle.bodyStyle);
  w.leafMaybe('transmission', vehicle.transmission);
  if (vehicle.odometer) writeOdometer(w, vehicle.odometer);
  w.leafMaybe('condition', vehicle.condition);
  for (const cc of vehicle.colorCombinations) writeColorCombination(w, cc);
  if (vehicle.imageTag) writeImageTag(w, vehicle.imageTag);
  if (vehicle.price) writePrice(w, vehicle.price);
  w.leafMaybe('pricecomments', vehicle.priceComments);
  for (const opt of vehicle.options) writeOption(w, opt);
  if (vehicle.finance) writeFinance(w, vehicle.finance);
  w.leafMaybe('comments', vehicle.comments);
  w.close('vehicle');
}

function writeTimeFrame(w: XMLWriter, tf: ADFTimeFrame): void {
  w.open('timeframe');
  w.leafMaybe('description', tf.description);
  w.leafMaybe('earliestdate', tf.earliestDate);
  w.leafMaybe('latestdate', tf.latestDate);
  w.close('timeframe');
}

function writeCustomer(w: XMLWriter, customer: ADFCustomer): void {
  w.open('customer');
  writeContact(w, customer.contact);
  for (const id of customer.ids) writeId(w, id);
  if (customer.timeFrame) writeTimeFrame(w, customer.timeFrame);
  w.leafMaybe('comments', customer.comments);
  w.close('customer');
}

function writeVendor(w: XMLWriter, vendor: ADFVendor): void {
  w.open('vendor');
  for (const id of vendor.ids) writeId(w, id);
  w.leaf('vendorname', vendor.vendorName);
  w.leafMaybe('url', vendor.url);
  writeContact(w, vendor.contact);
  w.close('vendor');
}

function writeProvider(w: XMLWriter, provider: ADFProvider): void {
  w.open('provider');
  for (const id of provider.ids) writeId(w, id);
  writeName(w, provider.name);
  w.leafMaybe('service', provider.service);
  w.leafMaybe('url', provider.url);
  w.leafMaybe('email', provider.email);
  w.leafMaybe('phone', provider.phone);
  if (provider.contact) writeContact(w, provider.contact);
  w.close('provider');
}

function writeProspect(w: XMLWriter, prospect: ADFProspect): void {
  w.open('prospect', {
    status: prospect.status !== 'new' ? prospect.status : undefined,
  });
  for (const id of prospect.ids) writeId(w, id);
  w.leaf('requestdate', prospect.requestDate);
  for (const v of prospect.vehicles) writeVehicle(w, v);
  writeCustomer(w, prospect.customer);
  writeVendor(w, prospect.vendor);
  if (prospect.provider) writeProvider(w, prospect.provider);
  w.close('prospect');
}

// ----------------------------------------------------------
// Public API
// ----------------------------------------------------------

/**
 * Serialize an {@link ADFDocument} to an ADF 1.0 XML string.
 */
export function serialize(doc: ADFDocument): string {
  const w = new XMLWriter();

  w.raw(`<?ADF version "${doc.version}"?>`);
  w.raw('<?xml version="1.0"?>');
  w.open('adf');

  for (const prospect of doc.prospects) {
    writeProspect(w, prospect);
  }

  w.close('adf');
  return w.toString();
}
