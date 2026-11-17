type RandomSource = {
  randomUUID?: () => string;
  getRandomValues?: (array: Uint8Array) => Uint8Array;
};

let sequence = 0;

/** Жергілікті жазба ID-і: HTTP IP мекенжайында да жұмыс істейді. Авторизация кілті емес. */
export function createRecordId(source: RandomSource | undefined = globalThis.crypto): string {
  if (typeof source?.randomUUID === "function") {
    try { return source.randomUUID(); } catch { /* Басқа қолжетімді жолды қолдану. */ }
  }
  if (typeof source?.getRandomValues === "function") {
    try {
      const bytes = source.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    } catch { /* Crypto қызметі бұғатталса, жергілікті баламаға өту. */ }
  }
  sequence += 1;
  return `local-${Date.now().toString(36)}-${sequence.toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
