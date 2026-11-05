import { attach } from "./combobox";
import type { Autocomplete, FieldTargets, Lang } from "./types";

export { attach, fieldValues, metaLine, streetLine } from "./combobox";
export { ApiError, DEFAULT_ENDPOINT, looksLikeNumber, shouldSearch } from "./client";
export type { AttachOptions, Autocomplete, Company, CompanyAddress, FieldTargets, Lang } from "./types";

const FIELDS: (keyof FieldTargets)[] = [
  "name",
  "vat",
  "enterprise",
  "street",
  "number",
  "box",
  "zipcode",
  "city",
  "country",
];
const attached = new WeakMap<HTMLInputElement, Autocomplete>();

/**
 * Attaches the widget to every `input[data-kbo-autocomplete]` under root that
 * has none yet, reading `data-kbo-key`, `data-kbo-lang`, `data-kbo-limit`,
 * `data-kbo-endpoint`, `data-kbo-unstyled` and `data-kbo-fill-*` (a CSS
 * selector per field). Returns the widgets it created.
 */
export function init(root: ParentNode = document): Autocomplete[] {
  const created: Autocomplete[] = [];
  for (const input of root.querySelectorAll<HTMLInputElement>("input[data-kbo-autocomplete]")) {
    if (attached.has(input)) continue;
    const d = input.dataset;
    if (!d["kboKey"]) {
      console.warn("[firmatlas-autocomplete] data-kbo-key is missing; the field works as a normal input.", input);
      continue;
    }
    const fields: FieldTargets = {};
    for (const f of FIELDS) {
      const selector = d[`kboFill${f[0]!.toUpperCase()}${f.slice(1)}`];
      if (selector) fields[f] = selector;
    }
    const w = attach(input, {
      key: d["kboKey"],
      fields,
      ...(d["kboLang"] ? { lang: d["kboLang"] as Lang } : {}),
      ...(d["kboLimit"] ? { limit: Number(d["kboLimit"]) } : {}),
      ...(d["kboEndpoint"] ? { endpoint: d["kboEndpoint"] } : {}),
      unstyled: d["kboUnstyled"] !== undefined,
    });
    attached.set(input, w);
    created.push(w);
  }
  return created;
}
