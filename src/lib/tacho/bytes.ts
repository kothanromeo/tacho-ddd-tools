/*
 * Lecture des types de base du chronotachygraphe (règlement 3821/85 annexe 1B, règlement 2016/799 annexe 1C).
 * Tous les entiers sont en gros-boutiste (octet de poids fort en premier).
 */

export class DddError extends Error {}

export class Reader {
  constructor(public readonly buf: Uint8Array, public pos = 0, public readonly end = buf.length) {}

  get remaining() {
    return this.end - this.pos;
  }

  private need(n: number) {
    if (this.pos + n > this.end) throw new DddError(`Données tronquées (lecture de ${n} octet(s) à la position ${this.pos}).`);
  }

  u8(): number {
    this.need(1);
    return this.buf[this.pos++];
  }

  u16(): number {
    this.need(2);
    const v = (this.buf[this.pos] << 8) | this.buf[this.pos + 1];
    this.pos += 2;
    return v;
  }

  u24(): number {
    this.need(3);
    const v = (this.buf[this.pos] << 16) | (this.buf[this.pos + 1] << 8) | this.buf[this.pos + 2];
    this.pos += 3;
    return v;
  }

  u32(): number {
    this.need(4);
    const v = this.buf[this.pos] * 0x1000000 + ((this.buf[this.pos + 1] << 16) | (this.buf[this.pos + 2] << 8) | this.buf[this.pos + 3]);
    this.pos += 4;
    return v;
  }

  bytes(n: number): Uint8Array {
    this.need(n);
    const b = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return b;
  }

  skip(n: number) {
    this.need(n);
    this.pos += n;
  }

  /** Sous-lecteur limité aux n octets suivants. */
  sub(n: number): Reader {
    this.need(n);
    const r = new Reader(this.buf, this.pos, this.pos + n);
    this.pos += n;
    return r;
  }

  /** TimeReal : secondes depuis le 01/01/1970 00:00 UTC ; 0 et 0xFFFFFFFF = absent. */
  time(): Date | undefined {
    const v = this.u32();
    return v === 0 || v === 0xffffffff ? undefined : new Date(v * 1000);
  }

  /** Datef : AAAAMMJJ en BCD sur 4 octets. */
  datef(): string | undefined {
    const b = this.bytes(4);
    const s = [...b].map((x) => (x >> 4).toString(16) + (x & 15).toString(16)).join('');
    if (!/^\d{8}$/.test(s) || s === '00000000') return undefined;
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }

  /** BCDString de n octets, en nombre. */
  bcd(n: number): number | undefined {
    const s = [...this.bytes(n)].map((x) => (x >> 4).toString(16) + (x & 15).toString(16)).join('');
    return /^\d+$/.test(s) ? Number(s) : undefined;
  }

  /** IA5String (ASCII) de longueur fixe, espaces et zéros de fin retirés. */
  ia5(n: number): string {
    return clean(latin1(this.bytes(n)));
  }

  /** Texte précédé de son octet de page de code (Name, VehicleRegistrationNumber…). */
  text(n: number): string {
    const codePage = this.u8();
    return decodeText(this.bytes(n), codePage);
  }
}

const latin1 = (b: Uint8Array) => String.fromCharCode(...b);
const clean = (s: string) => s.replace(/[\u0000￿]/g, ' ').replace(/[\s\u0000]+$/g, '').replace(/^\s+/, '');

/** Pages de code ISO 8859-n (1 à 16) ; 0 ou 255 : aucune information. */
export function decodeText(b: Uint8Array, codePage: number): string {
  if (b.every((x) => x === 0xff || x === 0x00 || x === 0x20)) return '';
  if (codePage >= 1 && codePage <= 16 && codePage !== 12) {
    try {
      return clean(new TextDecoder(codePage === 1 ? 'iso-8859-1' : `iso-8859-${codePage}`).decode(b));
    } catch {
      /* page de code non prise en charge par le navigateur : repli en Latin-1 */
    }
  }
  return clean(latin1(b));
}

/** Date AAAA-MM-JJ (UTC) d'un instant. */
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
