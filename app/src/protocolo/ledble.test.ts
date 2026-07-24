import { describe, expect, it } from "vitest";
import { ledble } from "./ledble";
import { byte, escalarRgb, porcento } from "./tipos";

const hex = (dados: Uint8Array) =>
  [...dados].map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");

describe("driver ELK-BLEDOM", () => {
  // Estes bytes sao a fonte de verdade: batem com descobertas/protocolo.json
  // e foram vistos funcionando na fita LEDBLE-00-1A5F.
  it("gera o quadro de ligar da familia LEDBLE", () => {
    expect(hex(ledble.ligar())).toBe("7E 00 04 01 00 00 00 00 EF");
  });

  it("gera o quadro de desligar confirmado no hardware", () => {
    expect(hex(ledble.desligar())).toBe("7E 00 04 00 00 00 FF 00 EF");
  });

  // Regressao contra os dois quadros de ligar que ja foram testados nesta
  // fita e ignorados em silencio. O primeiro e o mais citado na internet,
  // mas pertence a familia ELK, que escreve em FFF3 e nao em FFE1.
  it("nao volta a usar os quadros de ligar que a fita ignora", () => {
    const proibidos = ["7E 00 04 F0 00 01 FF 00 EF", "7E 00 04 00 00 01 FF 00 EF"];
    expect(proibidos).not.toContain(hex(ledble.ligar()));
  });

  it("gera o quadro de cor confirmado no hardware", () => {
    // Foi exatamente este amarelo que identificou a familia na fase 0.
    expect(hex(ledble.cor({ r: 255, g: 255, b: 0 }))).toBe("7E 00 05 03 FF FF 00 00 EF");
    expect(hex(ledble.cor({ r: 255, g: 0, b: 0 }))).toBe("7E 00 05 03 FF 00 00 00 EF");
    expect(hex(ledble.cor({ r: 0, g: 0, b: 0 }))).toBe("7E 00 05 03 00 00 00 00 EF");
  });

  it("usa escala 0 a 100 no brilho, nao 0 a 255", () => {
    expect(hex(ledble.brilho(50)!)).toBe("7E 00 01 32 00 00 00 00 EF");
    expect(hex(ledble.brilho(100)!)).toBe("7E 00 01 64 00 00 00 00 EF");
    expect(hex(ledble.brilho(0)!)).toBe("7E 00 01 00 00 00 00 00 EF");
  });

  it("todo quadro tem 9 bytes, abre com 7E e fecha com EF", () => {
    const quadros = [
      ledble.ligar(),
      ledble.desligar(),
      ledble.cor({ r: 1, g: 2, b: 3 }),
      ledble.brilho(42)!,
    ];
    for (const q of quadros) {
      expect(q.length).toBe(9);
      expect(q[0]).toBe(0x7e);
      expect(q[8]).toBe(0xef);
    }
  });

  // O controlador e mudo: um byte fora da faixa nao da erro, so faz o
  // comando sumir sem explicacao. Prender os valores nao e luxo.
  it("prende cores fora da faixa em vez de emitir byte invalido", () => {
    expect(hex(ledble.cor({ r: 300, g: -5, b: 12.6 }))).toBe("7E 00 05 03 FF 00 0D 00 EF");
    expect(hex(ledble.cor({ r: NaN, g: Infinity, b: 255.9 }))).toBe(
      "7E 00 05 03 00 FF FF 00 EF",
    );
  });

  it("prende o brilho fora da faixa", () => {
    expect(hex(ledble.brilho(150)!)).toBe("7E 00 01 64 00 00 00 00 EF");
    expect(hex(ledble.brilho(-20)!)).toBe("7E 00 01 00 00 00 00 00 EF");
    expect(hex(ledble.brilho(NaN)!)).toBe("7E 00 01 00 00 00 00 00 EF");
  });
});

describe("utilitarios de faixa", () => {
  it("byte arredonda e prende entre 0 e 255", () => {
    expect(byte(-1)).toBe(0);
    expect(byte(0.4)).toBe(0);
    expect(byte(127.5)).toBe(128);
    expect(byte(999)).toBe(255);
    expect(byte(NaN)).toBe(0);
  });

  it("porcento prende entre 0 e 100", () => {
    expect(porcento(-1)).toBe(0);
    expect(porcento(33.3)).toBe(33);
    expect(porcento(101)).toBe(100);
  });

  it("escalarRgb aplica o brilho na propria cor", () => {
    expect(escalarRgb({ r: 200, g: 100, b: 50 }, 50)).toEqual({ r: 100, g: 50, b: 25 });
    expect(escalarRgb({ r: 200, g: 100, b: 50 }, 0)).toEqual({ r: 0, g: 0, b: 0 });
    expect(escalarRgb({ r: 200, g: 100, b: 50 }, 100)).toEqual({ r: 200, g: 100, b: 50 });
  });
});
