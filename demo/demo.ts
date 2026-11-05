import { attach, init, type Company } from "../src/index";
import sample from "./sample.json";

// Open with ?key=kbo_pk_live_… (allowed for this origin) to use the live API,
// and &endpoint=… for another one. Without a key, answers come from
// sample.json: real API answers saved for a dozen companies.
const params = new URLSearchParams(location.search);
const key = params.get("key");
const endpoint = params.get("endpoint") ?? "https://api.firmatlas.be/v1/autocomplete";
const mode = document.getElementById("mode")!;

if (!key) {
  mode.textContent = "Sample data: add ?key=kbo_pk_live_… to use the live API";
  const answers = sample as Record<string, Company[]>;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    if (!url.pathname.endsWith("/v1/autocomplete")) return realFetch(input, init);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const lang = url.searchParams.get("lang") ?? "nl";
    const digits = q.replace(/\D/g, "");
    const hit = Object.entries(answers).find(([k]) => {
      const [l, query] = k.split("|") as [string, string];
      if (l !== lang) return false;
      return query.startsWith(q) || q.startsWith(query) || (digits.length >= 4 && query.replace(/\D/g, "").startsWith(digits));
    });
    let data = hit?.[1] ?? [];
    if (!hit && digits.length >= 4) {
      data = Object.values(answers)
        .flat()
        .filter((c, i, all) => c.number.includes(digits) && all.findIndex((x) => x.number === c.number) === i);
    }
    await new Promise((r) => setTimeout(r, 60));
    return new Response(JSON.stringify({ data: data.slice(0, Number(url.searchParams.get("limit") ?? 6)) }), {
      headers: { "Content-Type": "application/json" },
    });
  };
} else {
  mode.textContent = `Live API: ${endpoint}`;
}

const demoKey = key ?? "kbo_pk_live_demo";
document.getElementById("company")!.setAttribute("data-kbo-key", demoKey);
document.getElementById("company")!.setAttribute("data-kbo-endpoint", endpoint);
init();

const out = document.getElementById("event")!;
const fr = document.getElementById("fr-company") as HTMLInputElement;
attach(fr, { key: demoKey, lang: "fr", endpoint, onSelect: (c) => console.info("onSelect", c.name) });
fr.addEventListener("kbo:select", (e) => {
  out.textContent = `kbo:select →\n${JSON.stringify((e as CustomEvent<Company>).detail, null, 2)}`;
});
