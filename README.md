# @firmatlas/autocomplete

Belgian company search for any form. Visitors type a company name or enterprise number, pick the company, and the widget fills in its name, VAT number and registered address. The data comes from the KBO/BCE (Crossroads Bank for Enterprises) through the [Firmatlas](https://firmatlas.be) API.

- Under 5 KB gzipped, CSS included, no dependencies
- A WAI-ARIA combobox: arrow keys, Enter and Escape, screen-reader announcements, 44 px touch targets
- Names in Dutch, French, German or English
- Fails quietly: if the API is down or the key is refused, the input keeps working as a normal field and a warning goes to the console

## Get a key

The widget needs a **publishable key** (`kbo_pk_live_…`) from [firmatlas.be](https://firmatlas.be), with your site's origin (e.g. `https://shop.example.be`) on its allowed list. Publishable keys only reach the search and autocomplete endpoints and only from those origins, so they are safe in a web page. Never put a secret key (`kbo_sk_live_…`) in the browser.

## Use it with attributes

```html
<input
  data-kbo-autocomplete
  data-kbo-key="kbo_pk_live_…"
  data-kbo-fill-vat="#vat"
  data-kbo-fill-street="#street"
  data-kbo-fill-number="#number"
  data-kbo-fill-box="#box"
  data-kbo-fill-zipcode="#zipcode"
  data-kbo-fill-city="#city"
  data-kbo-fill-country="#country"
/>
<script src="https://cdn.jsdelivr.net/npm/@firmatlas/autocomplete@0.1.0/dist/firmatlas-autocomplete.iife.js" defer></script>
```

The script attaches itself to every `input[data-kbo-autocomplete]` once the page has loaded. For inputs added later, call `KboAutocomplete.init()`.

| Attribute | Meaning |
| --- | --- |
| `data-kbo-key` | Publishable key (required) |
| `data-kbo-lang` | `nl`, `fr`, `de` or `en`; defaults to the page's `<html lang>`, else `nl` |
| `data-kbo-limit` | Results to show, 1 to 8 (default 6) |
| `data-kbo-fill-name` | Company name; without it, the search input itself gets the name |
| `data-kbo-fill-vat` | VAT number, `BE0403170701` |
| `data-kbo-fill-enterprise` | Enterprise number, `0403.170.701` |
| `data-kbo-fill-street`, `-number`, `-box` | Street, house number, box |
| `data-kbo-fill-zipcode`, `-city` | Postcode and municipality |
| `data-kbo-fill-country` | `BE` for Belgian seats, else the country name; a `<select>` is matched on its option values |
| `data-kbo-unstyled` | Skip the built-in styles |
| `data-kbo-theme="auto"` | Follow the visitor's dark mode |
| `data-kbo-endpoint` | Another API endpoint, e.g. a self-hosted engine behind your own gateway |

Each `data-kbo-fill-*` value is a CSS selector. Filled fields get `input` and `change` events, so frameworks see the new values.

## Use it from code

```js
import { attach } from "@firmatlas/autocomplete";

const widget = attach(document.querySelector("#company"), {
  key: "kbo_pk_live_…",
  lang: "fr",
  fields: { vat: "#vat", street: "#street", number: "#number", zipcode: "#zipcode", city: "#city" },
  onSelect(company) {
    console.log(company.number, company.name);
  },
});

// Later: widget.destroy();
```

With the script tag, the same function is `KboAutocomplete.attach(input, options)`.

Every selection also fires a bubbling `kbo:select` event on the input, with the company as `event.detail`:

```json
{
  "number": "0403170701",
  "number_formatted": "0403.170.701",
  "vat_number": "BE0403170701",
  "name": "ELECTRABEL",
  "address": {
    "street": "Simon Bolivarlaan",
    "house_number": "36",
    "box": null,
    "zipcode": "1000",
    "municipality": "Brussel",
    "country": "België",
    "country_code": "BE"
  }
}
```

## Behaviour

- Searches after 3 characters, or at 4 digits when the input looks like an enterprise or VAT number (`0403.170.701`, `BE0403170701`). A full number shows that company and highlights it, so Enter picks it.
- Waits 150 ms after the last keystroke and cancels requests that a newer query replaced.
- Enter submits the form as usual unless a result is highlighted.
- The list opens below the input, or above it when there is no room, and closes on Escape, Tab or blur.

## Styling

The dropdown uses the classes `kbo-ac-popup`, `kbo-ac-list`, `kbo-ac-option` (with `aria-selected="true"` on the highlighted one), `kbo-ac-name`, `kbo-ac-meta`, `kbo-ac-empty` and `kbo-ac-credit`. Change the look with custom properties on `.kbo-ac-popup`:

```css
.kbo-ac-popup {
  --kbo-bg: #fff;
  --kbo-fg: #111827;
  --kbo-muted: #6b7280;
  --kbo-border: rgba(17, 24, 39, 0.12);
  --kbo-active: #f3f4f6;
  --kbo-radius: 10px;
  --kbo-font: inherit;
  --kbo-z: 2147483000;
}
```

Or pass `unstyled: true` (`data-kbo-unstyled`) and style the classes from scratch. Keep the "Data: KBO" credit visible: the KBO open data licence asks for the source to be named.

## Develop

```sh
npm install
npm test          # Vitest in jsdom, including an axe accessibility scan
npm run build     # dist/, fails over 10 KB gzipped
npm run demo      # http://localhost:5173/demo/ — sample data, or ?key=kbo_pk_live_… for the live API
```

## Licence

MIT. The company data is KBO/BCE open data from the FPS Economy, S.M.E.s, Self-employed and Energy; Firmatlas is not affiliated with the FPS Economy.
