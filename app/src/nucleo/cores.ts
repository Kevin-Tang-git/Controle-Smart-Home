import { byte, type Rgb } from "../protocolo/tipos";

/**
 * Conversoes de cor. Logica pura, sem DOM, para poder ser testada.
 *
 * O app trabalha em HSV porque e o que casa com uma roda de cor: o angulo
 * vira matiz e a distancia do centro vira saturacao. O valor (V) fica
 * sempre em 1 aqui, porque o escurecimento e trabalho do slider de brilho,
 * que vai por outro comando ate a fita.
 */

export interface Hsv {
  /** 0 a 360 */
  h: number;
  /** 0 a 1 */
  s: number;
  /** 0 a 1 */
  v: number;
}

export function hsvParaRgb({ h, s, v }: Hsv): Rgb {
  const matiz = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((matiz / 60) % 2) - 1));
  const m = v - c;

  let [r, g, b] = [0, 0, 0];
  if (matiz < 60) [r, g, b] = [c, x, 0];
  else if (matiz < 120) [r, g, b] = [x, c, 0];
  else if (matiz < 180) [r, g, b] = [0, c, x];
  else if (matiz < 240) [r, g, b] = [0, x, c];
  else if (matiz < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return { r: byte((r + m) * 255), g: byte((g + m) * 255), b: byte((b + m) * 255) };
}

export function rgbParaHsv({ r, g, b }: Rgb): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }
  if (h < 0) h += 360;

  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

export function rgbParaCss({ r, g, b }: Rgb): string {
  return `rgb(${byte(r)}, ${byte(g)}, ${byte(b)})`;
}

export function rgbParaHex({ r, g, b }: Rgb): string {
  const par = (n: number) => byte(n).toString(16).padStart(2, "0");
  return `#${par(r)}${par(g)}${par(b)}`;
}
