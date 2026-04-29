/**
 * Pan-African phone normaliser.
 * Accepts: 0712345678, +254712345678, 254712345678, 00254712345678 …
 * Returns E.164 (+CCxxxxxxxxx) or null if it can't be parsed.
 *
 * Country detection: explicit prefix wins, otherwise we assume Kenya for raw
 * 0XX numbers (most common case). Other African countries should be passed in
 * with the international prefix.
 */

const COUNTRY_PREFIXES = [
  '254', // Kenya
  '255', // Tanzania
  '256', // Uganda
  '250', // Rwanda
  '251', // Ethiopia
  '252', // Somalia
  '253', // Djibouti
  '257', // Burundi
  '260', // Zambia
  '263', // Zimbabwe
  '265', // Malawi
  '267', // Botswana
  '27',  // South Africa
  '233', // Ghana
  '234', // Nigeria
  '237', // Cameroon
  '20',  // Egypt
  '212', // Morocco
  '216', // Tunisia
  '218', // Libya
  '221', // Senegal
  '225', // Côte d'Ivoire
  '231', // Liberia
  '232', // Sierra Leone
  '244', // Angola
  '249', // Sudan
];

export function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim().replace(/[\s\-()\.]/g, '');

  if (s.startsWith('+')) s = s.slice(1);
  if (s.startsWith('00')) s = s.slice(2);

  if (!/^\d{7,15}$/.test(s)) return null;

  // Check if it already starts with a known country prefix
  const matchedPrefix = COUNTRY_PREFIXES.find(p => s.startsWith(p));
  if (matchedPrefix) {
    const local = s.slice(matchedPrefix.length);
    if (local.length < 6 || local.length > 12) return null;
    return `+${matchedPrefix}${local}`;
  }

  // Raw local number — default to Kenya (254). Drop leading zero if present.
  if (s.startsWith('0')) s = s.slice(1);
  if (s.length < 7 || s.length > 12) return null;
  return `+254${s}`;
}
