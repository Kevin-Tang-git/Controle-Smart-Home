import { describe, expect, it } from "vitest";
import { hsvParaRgb, rgbParaCss, rgbParaHex, rgbParaHsv } from "./cores";

describe("conversoes de cor", () => {
  it("converte os matizes primarios de HSV para RGB", () => {
    expect(hsvParaRgb({ h: 0, s: 1, v: 1 })).toEqual({ r: 255, g: 0, b: 0 });
    expect(hsvParaRgb({ h: 120, s: 1, v: 1 })).toEqual({ r: 0, g: 255, b: 0 });
    expect(hsvParaRgb({ h: 240, s: 1, v: 1 })).toEqual({ r: 0, g: 0, b: 255 });
    expect(hsvParaRgb({ h: 60, s: 1, v: 1 })).toEqual({ r: 255, g: 255, b: 0 });
  });

  it("sem saturacao devolve cinza, independente do matiz", () => {
    expect(hsvParaRgb({ h: 200, s: 0, v: 1 })).toEqual({ r: 255, g: 255, b: 255 });
    expect(hsvParaRgb({ h: 10, s: 0, v: 0.5 })).toEqual({ r: 128, g: 128, b: 128 });
  });

  // A roda de cor gera angulos continuos, entao passar de 360 ou receber
  // negativo acontece o tempo todo ao arrastar o dedo em volta do centro.
  it("normaliza matiz fora de 0 a 360", () => {
    expect(hsvParaRgb({ h: 360, s: 1, v: 1 })).toEqual(hsvParaRgb({ h: 0, s: 1, v: 1 }));
    expect(hsvParaRgb({ h: 480, s: 1, v: 1 })).toEqual(hsvParaRgb({ h: 120, s: 1, v: 1 }));
    expect(hsvParaRgb({ h: -120, s: 1, v: 1 })).toEqual(hsvParaRgb({ h: 240, s: 1, v: 1 }));
  });

  it("volta de RGB para HSV", () => {
    expect(rgbParaHsv({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 1, v: 1 });
    expect(rgbParaHsv({ r: 0, g: 255, b: 0 })).toEqual({ h: 120, s: 1, v: 1 });
    expect(rgbParaHsv({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, v: 0 });
  });

  it("faz a volta completa sem deriva perceptivel", () => {
    for (const original of [
      { r: 255, g: 0, b: 0 },
      { r: 12, g: 200, b: 90 },
      { r: 128, g: 128, b: 255 },
      { r: 255, g: 255, b: 255 },
    ]) {
      expect(hsvParaRgb(rgbParaHsv(original))).toEqual(original);
    }
  });

  it("formata para CSS e para hexadecimal", () => {
    expect(rgbParaCss({ r: 1, g: 2, b: 3 })).toBe("rgb(1, 2, 3)");
    expect(rgbParaHex({ r: 255, g: 0, b: 16 })).toBe("#ff0010");
  });
});
