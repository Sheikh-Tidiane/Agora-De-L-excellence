/**
 * Export CSV lisible par Excel et LibreOffice : séparateur « ; », BOM UTF-8, fins de ligne CRLF.
 * Les cellules qui commencent par = + - @ sont neutralisées (injection de formules).
 */
export type CsvCell = string | number | boolean | Date | null | undefined;

export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  let text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "boolean"
        ? value
          ? "oui"
          : "non"
        : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}
