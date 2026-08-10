/**
 * Minimal RFC 4180 CSV reader.
 *
 * The EA FC community datasets are quoted inconsistently (some quote every
 * field, some only the ones containing commas, and club/player names carry
 * commas, quotes and non-ASCII freely), so a naive split(",") mangles real
 * rows. This handles quoted fields, embedded commas/newlines, and doubled
 * quotes — which is all those files need — without pulling in a dependency
 * for what is a dev-only script.
 */

/** Parse CSV text into rows of raw string cells. */
export function parseCsv(text: string): string[][] {
  // Strip a UTF-8 BOM; several of the Kaggle exports carry one and it would
  // otherwise become part of the first header name.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let sawAnyChar = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      sawAnyChar = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
      sawAnyChar = true;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      // Skip blank lines rather than emitting a one-empty-cell row.
      if (!(row.length === 1 && row[0] === "" && !sawAnyChar)) rows.push(row);
      row = [];
      field = "";
      sawAnyChar = false;
    } else {
      field += c;
      sawAnyChar = true;
    }
  }

  if (field !== "" || row.length > 0 || sawAnyChar) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/** A CSV parsed into header-keyed records, with headers normalized for lookup. */
export interface CsvTable {
  /** Normalized header names, in file order. */
  headers: string[];
  /** One record per data row, keyed by normalized header. */
  rows: Record<string, string>[];
}

/**
 * Normalize a header for matching: lowercase, and collapse every run of
 * non-alphanumeric characters to a single underscore. Lets one alias list
 * match `Short passing`, `short_passing` and `ShortPassing` alike.
 */
export function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function readCsvTable(text: string): CsvTable {
  const raw = parseCsv(text);
  if (raw.length === 0) throw new Error("CSV is empty.");
  const headers = raw[0].map(normalizeHeader);
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < raw.length; r++) {
    const cells = raw[r];
    // Tolerate short/long rows rather than failing the whole import.
    if (cells.length === 1 && cells[0].trim() === "") continue;
    const rec: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) rec[headers[c]] = (cells[c] ?? "").trim();
    rows.push(rec);
  }
  return { headers, rows };
}
