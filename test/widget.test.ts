import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  attach,
  fieldValues,
  init,
  looksLikeNumber,
  metaLine,
  shouldSearch,
  streetLine,
  type Company,
} from "../src/index";
import { fetchCompanies } from "../src/client";
import { pickLang } from "../src/i18n";

const ELECTRABEL: Company = {
  number: "0403170701",
  number_formatted: "0403.170.701",
  vat_number: "BE0403170701",
  name: "ELECTRABEL",
  address: {
    street: "Simon Bolivarlaan",
    house_number: "36",
    box: null,
    zipcode: "1000",
    municipality: "Brussel",
    country: "België",
    country_code: "BE",
  },
};
const GREEN: Company = {
  ...ELECTRABEL,
  number: "0465399763",
  number_formatted: "0465.399.763",
  vat_number: "BE0465399763",
  name: "ELECTRABEL GREEN PROJECTS FLANDERS",
  address: { ...ELECTRABEL.address!, box: "2" },
};
const KEY = "kbo_pk_live_test";

function respond(data: Company[], status = 200): Response {
  const body = status === 200 ? { data } : { error: { code: "origin_not_allowed", message: "Not from this origin." } };
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DEBOUNCED = 220;

function type(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function key(input: HTMLInputElement, k: string): KeyboardEvent {
  const e = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true });
  input.dispatchEvent(e);
  return e;
}

describe("queries", () => {
  it("searches names from 3 characters and numbers from 4 digits", () => {
    expect(shouldSearch("el")).toBe(false);
    expect(shouldSearch("ele")).toBe(true);
    expect(looksLikeNumber("0403")).toBe(true);
    expect(looksLikeNumber("BE 0403.170")).toBe(true);
    expect(looksLikeNumber("040")).toBe(false);
    expect(looksLikeNumber("0403 bakkerij")).toBe(false);
    expect(shouldSearch(" 04 03 ")).toBe(true);
  });

  it("asks the API with the key, language and limit", async () => {
    const fetch = vi.fn(async () => respond([ELECTRABEL]));
    vi.stubGlobal("fetch", fetch);
    const ctl = new AbortController();
    const got = await fetchCompanies("electra", {
      key: KEY,
      lang: "fr",
      limit: 5,
      endpoint: "https://api.example/v1/autocomplete",
      signal: ctl.signal,
    });
    expect(got).toEqual([ELECTRABEL]);
    const [url, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.toString()).toBe("https://api.example/v1/autocomplete?q=electra&lang=fr&limit=5");
    expect(init.headers).toEqual({ "X-Api-Key": KEY });
    vi.unstubAllGlobals();
  });

  it("turns refusals and network failures into ApiError", async () => {
    const opts = { key: KEY, lang: "nl" as const, limit: 5, endpoint: "https://x/v1/autocomplete" };
    vi.stubGlobal("fetch", async () => respond([], 403));
    await expect(fetchCompanies("abc", { ...opts, signal: new AbortController().signal })).rejects.toMatchObject({
      status: 403,
      code: "origin_not_allowed",
      message: "Not from this origin.",
    });
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    const err = await fetchCompanies("abc", { ...opts, signal: new AbortController().signal }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    vi.unstubAllGlobals();
  });
});

describe("result text and fields", () => {
  it("writes addresses the Belgian way, per language", () => {
    expect(streetLine(GREEN)).toBe("Simon Bolivarlaan 36 bus 2");
    expect(streetLine(GREEN, "fr")).toBe("Simon Bolivarlaan 36 boîte 2");
    expect(metaLine(ELECTRABEL)).toBe("BE0403170701 · Simon Bolivarlaan 36, 1000 Brussel");
    const abroad: Company = {
      ...ELECTRABEL,
      address: { ...ELECTRABEL.address!, street: null, zipcode: null, municipality: null, country: "Frankrijk", country_code: null },
    };
    expect(metaLine(abroad)).toBe("BE0403170701 · Frankrijk");
    expect(metaLine({ ...ELECTRABEL, address: null })).toBe("BE0403170701");
  });

  it("maps a company onto the fillable fields", () => {
    expect(fieldValues(GREEN)).toEqual({
      name: "ELECTRABEL GREEN PROJECTS FLANDERS",
      vat: "BE0465399763",
      enterprise: "0465.399.763",
      street: "Simon Bolivarlaan",
      number: "36",
      box: "2",
      zipcode: "1000",
      city: "Brussel",
      country: "BE",
    });
  });

  it("picks the page language when none is given", () => {
    document.documentElement.lang = "fr-BE";
    expect(pickLang(undefined, document)).toBe("fr");
    expect(pickLang("de", document)).toBe("de");
    document.documentElement.lang = "es";
    expect(pickLang(undefined, document)).toBe("nl");
    document.documentElement.lang = "";
  });
});

describe("the combobox", () => {
  let fetch: ReturnType<typeof vi.fn>;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    document.body.innerHTML = `
      <form>
        <label for="company">Company</label><input id="company" name="company">
        <label for="vat">VAT</label><input id="vat">
        <label for="street">Street</label><input id="street">
        <label for="nr">Number</label><input id="nr">
        <label for="box">Box</label><input id="box">
        <label for="zip">Zip</label><input id="zip">
        <label for="city">City</label><input id="city">
        <label for="country">Country</label>
        <select id="country"><option value="">-</option><option value="BE">Belgium</option><option value="NL">Netherlands</option></select>
      </form>`;
    fetch = vi.fn(async () => respond([ELECTRABEL, GREEN]));
    vi.stubGlobal("fetch", fetch);
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    warn.mockRestore();
  });

  function setup(extra: Partial<Parameters<typeof attach>[1]> = {}) {
    const input = document.querySelector<HTMLInputElement>("#company")!;
    input.focus();
    const widget = attach(input, {
      key: KEY,
      lang: "nl",
      fields: { vat: "#vat", street: "#street", number: "#nr", box: "#box", zipcode: "#zip", city: "#city", country: "#country" },
      ...extra,
    });
    return { input, widget, listbox: document.getElementById(input.getAttribute("aria-controls")!)! };
  }

  it("is a WAI-ARIA combobox that lists results after a debounce", async () => {
    const { input, listbox } = setup();
    expect(input.getAttribute("role")).toBe("combobox");
    expect(input.getAttribute("aria-autocomplete")).toBe("list");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(listbox.getAttribute("role")).toBe("listbox");

    type(input, "el");
    type(input, "ele");
    type(input, "elec");
    await wait(DEBOUNCED);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0]![0])).toContain("q=elec");
    expect(input.getAttribute("aria-expanded")).toBe("true");
    const options = listbox.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(2);
    expect(options[1]!.textContent).toContain("Simon Bolivarlaan 36 bus 2, 1000 Brussel");
    expect(document.querySelector('[role="status"]')!.textContent).toBe("2 bedrijven gevonden");
    expect(document.querySelector(".kbo-ac-credit")!.textContent).toBe("Gegevens: KBO");
  });

  it("moves with the arrow keys and fills the form on Enter", async () => {
    const onSelect = vi.fn();
    const { input } = setup({ onSelect });
    const events: Company[] = [];
    input.addEventListener("kbo:select", (e) => events.push((e as CustomEvent<Company>).detail));
    const changed = vi.fn();
    document.querySelector("#zip")!.addEventListener("change", changed);

    type(input, "electrabel");
    await wait(DEBOUNCED);
    key(input, "ArrowDown");
    expect(input.getAttribute("aria-activedescendant")).toMatch(/-opt-0$/);
    key(input, "ArrowDown");
    key(input, "ArrowDown");
    expect(input.getAttribute("aria-activedescendant")).toMatch(/-opt-0$/);
    key(input, "ArrowUp");
    expect(input.getAttribute("aria-activedescendant")).toMatch(/-opt-1$/);
    expect(key(input, "Enter").defaultPrevented).toBe(true);

    const val = (s: string) => document.querySelector<HTMLInputElement>(s)!.value;
    expect(input.value).toBe("ELECTRABEL GREEN PROJECTS FLANDERS");
    expect([val("#vat"), val("#street"), val("#nr"), val("#box"), val("#zip"), val("#city"), val("#country")]).toEqual([
      "BE0465399763",
      "Simon Bolivarlaan",
      "36",
      "2",
      "1000",
      "Brussel",
      "BE",
    ]);
    expect(changed).toHaveBeenCalled();
    expect(events).toEqual([GREEN]);
    expect(onSelect).toHaveBeenCalledWith(GREEN);
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("lets Enter submit the form when nothing is highlighted, and closes on Escape", async () => {
    const { input } = setup();
    type(input, "electrabel");
    await wait(DEBOUNCED);
    expect(key(input, "Enter").defaultPrevented).toBe(false);
    expect(key(input, "Escape").defaultPrevented).toBe(true);
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(key(input, "Escape").defaultPrevented).toBe(false);
  });

  it("selects with a click without losing focus", async () => {
    const { input, listbox } = setup();
    type(input, "electrabel");
    await wait(DEBOUNCED);
    const first = listbox.querySelector<HTMLElement>('[role="option"]')!;
    const down = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    first.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    first.click();
    expect(input.value).toBe("ELECTRABEL");
  });

  it("searches numbers at once and highlights a single match", async () => {
    fetch.mockImplementation(async () => respond([ELECTRABEL]));
    const { input } = setup();
    type(input, "0403.170.701");
    await wait(DEBOUNCED);
    expect(String(fetch.mock.calls[0]![0])).toContain("q=0403.170.701");
    expect(input.getAttribute("aria-activedescendant")).toMatch(/-opt-0$/);
  });

  it("ignores answers to queries that were already replaced", async () => {
    let release: (() => void) | null = null;
    fetch.mockImplementationOnce(
      (async (_url: URL, init: RequestInit) => {
        await new Promise<void>((r) => (release = r));
        init.signal?.throwIfAborted();
        return respond([GREEN]);
      }) as never,
    );
    fetch.mockImplementationOnce(async () => respond([ELECTRABEL]));
    const { input, listbox } = setup();
    type(input, "elec");
    await wait(DEBOUNCED);
    type(input, "electrabel");
    await wait(DEBOUNCED);
    release!();
    await wait(10);
    const names = [...listbox.querySelectorAll(".kbo-ac-name")].map((n) => n.textContent);
    expect(names).toEqual(["ELECTRABEL"]);
  });

  it("falls back to a plain field when the key is refused", async () => {
    fetch.mockImplementation(async () => respond([], 403));
    const { input } = setup();
    type(input, "electrabel");
    await wait(DEBOUNCED);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Not from this origin."));
    expect(input.getAttribute("aria-expanded")).toBe("false");
    type(input, "electrabel nv");
    await wait(DEBOUNCED);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(input.value).toBe("electrabel nv");
  });

  it("stays quiet when the API is down", async () => {
    fetch.mockImplementation(async () => {
      throw new TypeError("Failed to fetch");
    });
    const { input } = setup();
    type(input, "electrabel");
    await wait(DEBOUNCED);
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(warn).toHaveBeenCalled();
  });

  it("shows when nothing matches", async () => {
    fetch.mockImplementation(async () => respond([]));
    const { input } = setup();
    type(input, "zzzzzz");
    await wait(DEBOUNCED);
    expect(document.querySelector<HTMLElement>(".kbo-ac-empty")!.hidden).toBe(false);
    expect(document.querySelector('[role="status"]')!.textContent).toBe("Geen bedrijf gevonden");
  });

  it("passes an axe scan with the list open", async () => {
    const { input } = setup();
    type(input, "electrabel");
    await wait(DEBOUNCED);
    key(input, "ArrowDown");
    document.title = "Checkout";
    document.documentElement.lang = "nl";
    const result = await axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
      rules: { "color-contrast": { enabled: false } },
    });
    document.documentElement.lang = "";
    expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it("leaves the input as it was on destroy", async () => {
    const { input, widget } = setup();
    widget.destroy();
    expect(input.getAttribute("role")).toBeNull();
    expect(input.getAttribute("aria-expanded")).toBeNull();
    expect(input.getAttribute("autocomplete")).toBeNull();
    expect(document.querySelector(".kbo-ac-popup")).toBeNull();
    type(input, "electrabel");
    await wait(DEBOUNCED);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("injects its styles once, or not at all when unstyled", () => {
    setup();
    setup();
    expect(document.querySelectorAll("style[data-kbo-autocomplete]")).toHaveLength(1);
    document.querySelector("style[data-kbo-autocomplete]")!.remove();
    setup({ unstyled: true });
    expect(document.querySelector("style[data-kbo-autocomplete]")).toBeNull();
  });
});

describe("declarative setup", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("attaches to data-kbo-autocomplete inputs and reads data-kbo-fill-*", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respond([ELECTRABEL])));
    document.body.innerHTML = `
      <input id="c" data-kbo-autocomplete data-kbo-key="${KEY}" data-kbo-lang="fr" data-kbo-fill-vat="#v" data-kbo-fill-city="#city">
      <input id="v"><input id="city"><input id="nokey" data-kbo-autocomplete>`;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(init()).toHaveLength(1);
    expect(init()).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("data-kbo-key"), expect.anything());
    const input = document.querySelector<HTMLInputElement>("#c")!;
    input.focus();
    type(input, "0403170701");
    await wait(DEBOUNCED);
    expect(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0])).toContain("lang=fr");
    key(input, "Enter");
    expect(document.querySelector<HTMLInputElement>("#v")!.value).toBe("BE0403170701");
    expect(document.querySelector<HTMLInputElement>("#city")!.value).toBe("Brussel");
    warn.mockRestore();
  });
});
