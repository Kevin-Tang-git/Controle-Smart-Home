import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ledble } from "../protocolo/ledble";
import type { DriverLed, Rgb } from "../protocolo/tipos";
import { byte } from "../protocolo/tipos";
import { TransporteFalso } from "../transporte/falso";
import { ControladorFita } from "./controlador";

/** Driver de mentira sem brilho nativo, para exercitar o plano B. */
const semBrilho: DriverLed = {
  id: "teste-sem-brilho",
  nome: "Teste",
  servico: "0000ffd5-0000-1000-8000-00805f9b34fb",
  caracteristica: "0000ffd9-0000-1000-8000-00805f9b34fb",
  semResposta: true,
  brilhoNativo: false,
  prefixosNome: ["TESTE"],
  ligar: () => new Uint8Array([0xcc, 0x23, 0x33]),
  desligar: () => new Uint8Array([0xcc, 0x24, 0x33]),
  cor: ({ r, g, b }: Rgb) => new Uint8Array([0x56, byte(r), byte(g), byte(b)]),
  brilho: () => null,
};

describe("ControladorFita", () => {
  let transporte: TransporteFalso;

  beforeEach(() => {
    vi.useFakeTimers();
    transporte = new TransporteFalso();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const criar = (driver: DriverLed = ledble) =>
    new ControladorFita(driver, transporte, { intervaloMs: 60 });

  // O hardware nunca confirma nada, entao a interface nao pode esperar.
  it("atualiza o estado na hora, antes de qualquer byte sair", () => {
    const c = criar();
    c.definirCor({ r: 10, g: 20, b: 30 });

    expect(c.estado.cor).toEqual({ r: 10, g: 20, b: 30 });
    expect(c.estado.ligada).toBe(true);
    expect(transporte.escritas).toHaveLength(0); // ainda na fila
  });

  it("avisa quem estiver assinando", () => {
    const c = criar();
    const ouvinte = vi.fn();
    const cancelar = c.assinar(ouvinte);

    c.definirBrilho(40);
    expect(ouvinte).toHaveBeenCalledTimes(1);

    cancelar();
    c.definirBrilho(10);
    expect(ouvinte).toHaveBeenCalledTimes(1);
  });

  it("ao ligar, reafirma cor e brilho junto", async () => {
    const c = criar();
    c.definirCor({ r: 255, g: 0, b: 0 });
    c.definirBrilho(50);
    await vi.advanceTimersByTimeAsync(500);
    transporte.escritas.length = 0;

    c.ligar();
    await vi.advanceTimersByTimeAsync(500);

    expect(transporte.hex).toEqual([
      "7E 00 04 01 00 00 00 00 EF", // energia
      "7E 00 05 03 FF 00 00 00 EF", // cor
      "7E 00 01 32 00 00 00 00 EF", // brilho 50
    ]);
  });

  it("desligar manda o quadro de desligar e marca o estado", async () => {
    const c = criar();
    c.ligar();
    await vi.advanceTimersByTimeAsync(500);
    transporte.escritas.length = 0;

    c.desligar();
    await vi.advanceTimersByTimeAsync(500);

    expect(c.estado.ligada).toBe(false);
    expect(transporte.hex).toEqual(["7E 00 04 00 00 00 FF 00 EF"]);
  });

  it("alternar vai e volta", () => {
    const c = criar();
    expect(c.estado.ligada).toBe(false);
    c.alternar();
    expect(c.estado.ligada).toBe(true);
    c.alternar();
    expect(c.estado.ligada).toBe(false);
  });

  it("com brilho nativo, o brilho vai em quadro proprio e a cor nao muda", async () => {
    const c = criar();
    c.definirCor({ r: 200, g: 100, b: 50 });
    await vi.advanceTimersByTimeAsync(500);
    transporte.escritas.length = 0;

    c.definirBrilho(50);
    await vi.advanceTimersByTimeAsync(500);

    expect(transporte.hex).toEqual(["7E 00 01 32 00 00 00 00 EF"]);
  });

  it("sem brilho nativo, o brilho e embutido na cor enviada", async () => {
    const c = criar(semBrilho);
    c.definirCor({ r: 200, g: 100, b: 50 });
    await vi.advanceTimersByTimeAsync(500);
    transporte.escritas.length = 0;

    c.definirBrilho(50);
    await vi.advanceTimersByTimeAsync(500);

    expect(transporte.hex).toEqual(["56 64 32 19"]); // 100, 50, 25
    // A cor guardada continua sendo a original, so o envio e que foi escalado.
    expect(c.estado.cor).toEqual({ r: 200, g: 100, b: 50 });
  });

  it("uma rajada de cor vira uma escrita so", async () => {
    const c = criar();
    for (let i = 0; i < 100; i++) c.definirCor({ r: i, g: 0, b: 0 });
    await vi.advanceTimersByTimeAsync(1000);

    expect(transporte.escritas).toHaveLength(1);
    expect(transporte.escritas[0].dados[4]).toBe(99);
  });

  it("abortarPendentes descarta o que nao saiu", async () => {
    const c = criar();
    c.definirCor({ r: 1, g: 2, b: 3 });
    c.abortarPendentes();
    await vi.advanceTimersByTimeAsync(500);

    expect(transporte.escritas).toHaveLength(0);
  });
});
