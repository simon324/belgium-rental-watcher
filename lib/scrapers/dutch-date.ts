// Parses 2dehands.be `date` strings into a Date.
// Examples observed: "vandaag", "gisteren", "eergisteren", "3 uur geleden",
// "30 min. geleden", "Vandaag, 10:23", "8 mei 26", "1 mei '26".
// Returns null if the format is unrecognized.

const MONTHS_NL: Record<string, number> = {
  jan: 0, feb: 1, mrt: 2, maart: 2, apr: 3, mei: 4, jun: 5, juni: 5,
  jul: 6, juli: 6, aug: 7, sep: 8, sept: 8, okt: 9, nov: 10, dec: 11,
};

export function parseDutchDate(input: string, now: Date = new Date()): Date | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  if (s.startsWith("vandaag") || s === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  }
  if (s.startsWith("gisteren") || s === "yesterday") {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    d.setHours(12, 0, 0, 0);
    return d;
  }
  if (s.startsWith("eergisteren")) {
    const d = new Date(now);
    d.setDate(d.getDate() - 2);
    d.setHours(12, 0, 0, 0);
    return d;
  }

  // Relative: "3 uur geleden", "30 min. geleden", "2 dagen geleden"
  const rel = s.match(/^(\d+)\s*(min|minute|minuten|uur|uren|dag|dagen|week|weken)\.?\s*geleden/);
  if (rel) {
    const n = parseInt(rel[1], 10);
    const unit = rel[2];
    const ms =
      unit.startsWith("min") ? n * 60_000 :
      unit.startsWith("uur") || unit.startsWith("ure") ? n * 3_600_000 :
      unit.startsWith("dag") ? n * 86_400_000 :
      unit.startsWith("week") || unit.startsWith("weken") ? n * 7 * 86_400_000 :
      0;
    return new Date(now.getTime() - ms);
  }

  // Absolute: "8 mei 26" / "1 mei '26" / "8 mei"
  const abs = s.match(/^(\d{1,2})\s+([a-z]+)\.?\s*'?(\d{2,4})?$/);
  if (abs) {
    const day = parseInt(abs[1], 10);
    const monKey = abs[2].slice(0, 4);
    const monKey3 = abs[2].slice(0, 3);
    const m = MONTHS_NL[monKey] ?? MONTHS_NL[monKey3];
    if (m === undefined) return null;
    let year = abs[3] ? parseInt(abs[3], 10) : now.getFullYear();
    if (year < 100) year += 2000;
    return new Date(year, m, day, 12, 0, 0);
  }

  return null;
}

export function isWithinLastHours(date: Date, hours: number, now: Date = new Date()): boolean {
  return now.getTime() - date.getTime() <= hours * 3_600_000 && date.getTime() <= now.getTime() + 60_000;
}
