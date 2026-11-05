import { ApiError, DEFAULT_ENDPOINT, fetchCompanies, looksLikeNumber, shouldSearch } from "./client";
import { pickLang, texts } from "./i18n";
import css from "./styles.css?raw";
import type { AttachOptions, Autocomplete, Company, FieldTargets, Lang } from "./types";

const DEBOUNCE_MS = 150;
const DEFAULT_LIMIT = 6;
const GAP = 4;
let uid = 0;
function warner(): (message: string) => void {
  const warned = new Set<string>();
  return (message) => {
    if (warned.has(message)) return;
    warned.add(message);
    console.warn(`[firmatlas-autocomplete] ${message}`);
  };
}

function injectStyles(doc: Document): void {
  if (doc.querySelector("style[data-kbo-autocomplete]")) return;
  const style = doc.createElement("style");
  style.setAttribute("data-kbo-autocomplete", "");
  style.textContent = css;
  doc.head.append(style);
}

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  e.className = className;
  return e;
}

const BOX: Record<Lang, string> = { nl: "bus", fr: "boîte", de: "Bf.", en: "box" };

/** Joins the street, house number and box the Belgian way: `Simon Bolivarlaan 36 bus 2`. */
export function streetLine(c: Company, lang: Lang = "nl"): string {
  const a = c.address;
  if (!a?.street) return "";
  return [a.street, a.house_number, a.box ? `${BOX[lang]} ${a.box}` : null].filter(Boolean).join(" ");
}

/** The second line of a result: VAT number and address. */
export function metaLine(c: Company, lang: Lang = "nl"): string {
  const a = c.address;
  const place = [a?.zipcode, a?.municipality].filter(Boolean).join(" ");
  const abroad = a?.country && a.country_code !== "BE" ? a.country : null;
  const address = [streetLine(c, lang), place, abroad].filter(Boolean).join(", ");
  return [c.vat_number, address].filter(Boolean).join(" · ");
}

/** The value each fillable field gets from a company. */
export function fieldValues(c: Company): Record<keyof FieldTargets, string> {
  const a = c.address;
  return {
    name: c.name,
    vat: c.vat_number,
    enterprise: c.number_formatted,
    street: a?.street ?? "",
    number: a?.house_number ?? "",
    box: a?.box ?? "",
    zipcode: a?.zipcode ?? "",
    city: a?.municipality ?? "",
    country: a?.country_code ?? a?.country ?? "",
  };
}

function resolveTarget(
  doc: Document,
  t: string | HTMLElement | undefined,
  warnOnce: (m: string) => void,
): HTMLElement | null {
  if (!t) return null;
  if (typeof t !== "string") return t;
  try {
    return doc.querySelector<HTMLElement>(t);
  } catch {
    warnOnce(`"${t}" is not a valid selector for a field to fill.`);
    return null;
  }
}

function setValue(target: HTMLElement, value: string): void {
  if (target instanceof HTMLSelectElement) {
    const opt = [...target.options].find((o) => o.value.toLowerCase() === value.toLowerCase());
    if (!opt) return;
    target.value = opt.value;
  } else if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    target.value = value;
  } else {
    return;
  }
  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Turns a text input into a company search: a WAI-ARIA combobox that queries
 * the Firmatlas API as the visitor types and, on selection, fills the form's
 * company, VAT and address fields and fires `kbo:select`. If the API is
 * unreachable or the key is refused, the input keeps working as a normal field.
 */
export function attach(input: HTMLInputElement, options: AttachOptions): Autocomplete {
  const doc = input.ownerDocument;
  const win = doc.defaultView ?? window;
  if (!options.unstyled) injectStyles(doc);
  const lang = pickLang(options.lang, doc);
  const t = texts(lang);
  const limit = Math.min(8, Math.max(1, Math.trunc(options.limit ?? DEFAULT_LIMIT)));
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const id = `kbo-ac-${++uid}`;
  const warnOnce = warner();

  const popup = el(doc, "div", "kbo-ac-popup");
  popup.hidden = true;
  popup.setAttribute("data-theme", input.getAttribute("data-kbo-theme") === "auto" ? "auto" : "light");
  const list = el(doc, "ul", "kbo-ac-list");
  list.id = `${id}-list`;
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", t.label);
  const empty = el(doc, "div", "kbo-ac-empty");
  empty.textContent = t.none;
  empty.hidden = true;
  const credit = el(doc, "div", "kbo-ac-credit");
  credit.textContent = t.credit;
  popup.append(list, empty, credit);
  const status = el(doc, "div", "kbo-ac-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  doc.body.append(popup, status);

  const before = {
    role: input.getAttribute("role"),
    autocomplete: input.getAttribute("autocomplete"),
  };
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", list.id);
  input.setAttribute("autocomplete", "off");

  let results: Company[] = [];
  let active = -1;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let controller: AbortController | null = null;
  let seq = 0;
  let disabled = false;
  let lastQuery = "";
  let filling = false;

  function position(): void {
    const r = input.getBoundingClientRect();
    const height = popup.offsetHeight;
    const below = win.innerHeight - r.bottom;
    const up = below < height + GAP && r.top > below;
    popup.dataset["side"] = up ? "top" : "bottom";
    popup.style.left = `${Math.round(r.left)}px`;
    popup.style.width = `${Math.round(r.width)}px`;
    popup.style.top = up ? `${Math.round(r.top - height - GAP)}px` : `${Math.round(r.bottom + GAP)}px`;
  }

  function open(): void {
    if (!popup.hidden) return;
    popup.hidden = false;
    input.setAttribute("aria-expanded", "true");
    position();
    win.addEventListener("scroll", position, true);
    win.addEventListener("resize", position);
  }

  function close(): void {
    if (popup.hidden) return;
    popup.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
    win.removeEventListener("scroll", position, true);
    win.removeEventListener("resize", position);
  }

  function setActive(i: number): void {
    const items = list.children;
    if (active >= 0) items[active]?.setAttribute("aria-selected", "false");
    active = i;
    const item = items[i] as HTMLElement | undefined;
    if (!item) {
      input.removeAttribute("aria-activedescendant");
      return;
    }
    item.setAttribute("aria-selected", "true");
    input.setAttribute("aria-activedescendant", item.id);
    item.scrollIntoView?.({ block: "nearest" });
  }

  function render(companies: Company[]): void {
    results = companies;
    active = -1;
    input.removeAttribute("aria-activedescendant");
    list.replaceChildren(
      ...companies.map((c, i) => {
        const li = el(doc, "li", "kbo-ac-option");
        li.id = `${id}-opt-${i}`;
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", "false");
        const name = el(doc, "span", "kbo-ac-name");
        name.textContent = c.name;
        const meta = el(doc, "span", "kbo-ac-meta");
        meta.textContent = metaLine(c, lang);
        li.append(name, meta);
        return li;
      }),
    );
    empty.hidden = companies.length > 0;
    status.textContent = companies.length ? t.results(companies.length) : t.none;
    open();
    position();
    if (companies.length === 1 && looksLikeNumber(lastQuery)) setActive(0);
  }

  function select(i: number): void {
    const c = results[i];
    if (!c) return;
    const values = fieldValues(c);
    const fields = options.fields ?? {};
    let inputFilled = false;
    filling = true;
    try {
      for (const k of Object.keys(values) as (keyof FieldTargets)[]) {
        const target = resolveTarget(doc, fields[k], warnOnce);
        if (!target) continue;
        if (target === input) inputFilled = true;
        setValue(target, values[k]);
      }
      if (!inputFilled) setValue(input, c.name);
    } finally {
      filling = false;
    }
    if (timer) clearTimeout(timer);
    controller?.abort();
    seq++;
    lastQuery = input.value;
    close();
    input.dispatchEvent(new CustomEvent<Company>("kbo:select", { bubbles: true, detail: c }));
    options.onSelect?.(c);
  }

  async function search(q: string): Promise<void> {
    controller?.abort();
    const mine = ++seq;
    controller = new AbortController();
    try {
      const companies = await fetchCompanies(q, { key: options.key, lang, limit, endpoint, signal: controller.signal });
      if (mine !== seq || doc.activeElement !== input) return;
      render(companies);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      close();
      if (err instanceof ApiError && [401, 402, 403].includes(err.status)) {
        disabled = true;
        warnOnce(`${err.message} Company search is off; the field works as a normal input.`);
      } else {
        warnOnce(err instanceof Error ? err.message : String(err));
      }
    }
  }

  function onInput(): void {
    if (filling) return;
    const q = input.value;
    lastQuery = q;
    if (timer) clearTimeout(timer);
    if (disabled || !shouldSearch(q)) {
      controller?.abort();
      seq++;
      close();
      return;
    }
    timer = setTimeout(() => void search(q.trim()), DEBOUNCE_MS);
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.isComposing) return;
    const openList = !popup.hidden && results.length > 0;
    switch (e.key) {
      case "ArrowDown":
        if (!openList) {
          if (results.length && input.value === lastQuery) {
            open();
            setActive(0);
            e.preventDefault();
          }
          return;
        }
        e.preventDefault();
        setActive((active + 1) % results.length);
        return;
      case "ArrowUp":
        if (!openList) return;
        e.preventDefault();
        setActive(active <= 0 ? results.length - 1 : active - 1);
        return;
      case "Enter":
        if (openList && active >= 0) {
          e.preventDefault();
          select(active);
        }
        return;
      case "Escape":
        if (!popup.hidden) {
          e.preventDefault();
          close();
        }
        return;
      case "Tab":
        close();
        return;
    }
  }

  function onListPointerDown(e: PointerEvent): void {
    e.preventDefault();
  }

  function onListClick(e: MouseEvent): void {
    const li = (e.target as Element | null)?.closest?.(".kbo-ac-option");
    if (!li) return;
    select([...list.children].indexOf(li));
  }

  function onListMove(e: PointerEvent): void {
    if (e.pointerType !== "mouse") return;
    const li = (e.target as Element | null)?.closest?.(".kbo-ac-option");
    const i = li ? [...list.children].indexOf(li) : -1;
    if (i >= 0 && i !== active) setActive(i);
  }

  function onBlur(): void {
    close();
  }

  input.addEventListener("input", onInput);
  input.addEventListener("keydown", onKeyDown);
  input.addEventListener("blur", onBlur);
  popup.addEventListener("pointerdown", onListPointerDown);
  popup.addEventListener("mousedown", onListPointerDown as unknown as EventListener);
  list.addEventListener("click", onListClick);
  list.addEventListener("pointermove", onListMove);

  return {
    destroy() {
      if (timer) clearTimeout(timer);
      controller?.abort();
      close();
      input.removeEventListener("input", onInput);
      input.removeEventListener("keydown", onKeyDown);
      input.removeEventListener("blur", onBlur);
      popup.remove();
      status.remove();
      for (const a of ["aria-autocomplete", "aria-expanded", "aria-controls", "aria-activedescendant"]) {
        input.removeAttribute(a);
      }
      if (before.role === null) input.removeAttribute("role");
      else input.setAttribute("role", before.role);
      if (before.autocomplete === null) input.removeAttribute("autocomplete");
      else input.setAttribute("autocomplete", before.autocomplete);
    },
  };
}
