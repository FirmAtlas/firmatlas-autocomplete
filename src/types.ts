/** A company's registered seat, split for form fields. Missing parts are null. */
export interface CompanyAddress {
  street: string | null;
  house_number: string | null;
  box: string | null;
  zipcode: string | null;
  municipality: string | null;
  country: string | null;
  /** ISO 3166-1 alpha-2, `BE` for Belgian seats; null when KBO only names the country. */
  country_code: string | null;
}

/** One autocomplete result, as the Firmatlas API returns it. */
export interface Company {
  /** Enterprise number, 10 digits. */
  number: string;
  /** Enterprise number with dots, e.g. `0403.170.701`. */
  number_formatted: string;
  /** VAT number, e.g. `BE0403170701`. */
  vat_number: string;
  name: string;
  address: CompanyAddress | null;
}

/** The form fields a selection fills. Each value is an element or a CSS selector. */
export interface FieldTargets {
  name?: string | HTMLElement;
  vat?: string | HTMLElement;
  enterprise?: string | HTMLElement;
  street?: string | HTMLElement;
  number?: string | HTMLElement;
  box?: string | HTMLElement;
  zipcode?: string | HTMLElement;
  city?: string | HTMLElement;
  country?: string | HTMLElement;
}

/** Interface languages; also the language names and addresses come back in. */
export type Lang = "nl" | "fr" | "de" | "en";

/** Options for {@link attach}. */
export interface AttachOptions {
  /** A publishable key (`kbo_pk_live_…`) allowed for this site's origin. */
  key: string;
  /** Defaults to the page's `<html lang>` when it is nl, fr, de or en, else nl. */
  lang?: Lang;
  /** Form fields to fill on selection. */
  fields?: FieldTargets;
  /** Called with the chosen company, after the fields are filled. */
  onSelect?: (company: Company) => void;
  /** Skip the built-in styles; style the `kbo-ac-*` classes yourself. */
  unstyled?: boolean;
  /** At most this many results, 1 to 8. Default 6. */
  limit?: number;
  /** The autocomplete endpoint. Default `https://api.firmatlas.be/v1/autocomplete`. */
  endpoint?: string;
}

/** A live widget on one input. */
export interface Autocomplete {
  /** Removes the widget and its listeners; the input stays as it was. */
  destroy(): void;
}
