import type { Lang } from "./types";

/** Interface texts of the widget. */
export interface Texts {
  results: (n: number) => string;
  none: string;
  credit: string;
  label: string;
}

const TEXTS: Record<Lang, Texts> = {
  nl: {
    results: (n) => (n === 1 ? "1 bedrijf gevonden" : `${n} bedrijven gevonden`),
    none: "Geen bedrijf gevonden",
    credit: "Gegevens: KBO",
    label: "Bedrijven",
  },
  fr: {
    results: (n) => (n === 1 ? "1 entreprise trouvée" : `${n} entreprises trouvées`),
    none: "Aucune entreprise trouvée",
    credit: "Données : BCE",
    label: "Entreprises",
  },
  de: {
    results: (n) => (n === 1 ? "1 Unternehmen gefunden" : `${n} Unternehmen gefunden`),
    none: "Kein Unternehmen gefunden",
    credit: "Daten: ZDU",
    label: "Unternehmen",
  },
  en: {
    results: (n) => (n === 1 ? "1 company found" : `${n} companies found`),
    none: "No company found",
    credit: "Data: KBO",
    label: "Companies",
  },
};

/** Returns the texts of a language. */
export function texts(lang: Lang): Texts {
  return TEXTS[lang];
}

/** Picks the widget language: the given one, else the page's `<html lang>`, else nl. */
export function pickLang(given: string | null | undefined, doc: Document): Lang {
  for (const raw of [given, doc.documentElement.lang]) {
    const l = (raw ?? "").slice(0, 2).toLowerCase();
    if (l === "nl" || l === "fr" || l === "de" || l === "en") return l;
  }
  return "nl";
}
