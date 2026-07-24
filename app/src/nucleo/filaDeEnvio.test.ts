import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FilaDeEnvio } from "./filaDeEnvio";

const bytes = (...v: number[]) => new Uint8Array(v);

describe("FilaDeEnvio", () => {
  let escritas: { dados: Uint8Array; em: number }[];
  let fila: FilaDeEnvio;
  let falhas: unknown[];

  beforeEach(() => {
    vi.useFakeTimers();
    escritas = [];
    falhas = [];
    fila = new FilaDeEnvio(
      async (dados) => {
        escritas.push({ dados, em: Date.now() });
      },
      { intervaloMs: 60, aoFalhar: (e) => falhas.push(e) },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // O caso que motiva a classe inteira: arrastar o dedo no seletor de cor.
  it("descarta os valores intermediarios de uma rajada e envia so o ultimo", async () => {
    for (let i = 0; i < 200; i++) fila.enfileirar("cor", bytes(0x7e, i));
    await vi.advanceTimersByTimeAsync(500);

    expect(escritas).toHaveLength(1);
    expect(escritas[0].dados[1]).toBe(199);
  });

  it("respeita o intervalo minimo entre escritas", async () => {
    fila.enfileirar("cor", bytes(1));
    await vi.advanceTimersByTimeAsync(0);
    fila.enfileirar("cor", bytes(2));
    await vi.advanceTimersByTimeAsync(10);
    expect(escritas).toHaveLength(1); // ainda dentro da janela

    await vi.advanceTimersByTimeAsync(60);
    expect(escritas).toHaveLength(2);
    expect(escritas[1].em - escritas[0].em).toBeGreaterThanOrEqual(60);
  });

  // Uma rajada de cor nao pode fazer o comando de desligar morrer de fome.
  it("nao deixa um tipo atropelar outro", async () => {
    fila.enfileirar("cor", bytes(0xaa));
    fila.enfileirar("energia", bytes(0xbb));
    fila.enfileirar("cor", bytes(0xcc)); // coalesce, mantendo a posicao
    await vi.advanceTimersByTimeAsync(500);

    expect(escritas.map((e) => e.dados[0])).toEqual([0xcc, 0xbb]);
  });

  it("esvazia a fila inteira ao longo do tempo", async () => {
    fila.enfileirar("a", bytes(1));
    fila.enfileirar("b", bytes(2));
    fila.enfileirar("c", bytes(3));
    expect(fila.tamanho).toBe(3);

    await vi.advanceTimersByTimeAsync(500);
    expect(escritas.map((e) => e.dados[0])).toEqual([1, 2, 3]);
    expect(fila.tamanho).toBe(0);
  });

  it("limpar cancela o que ainda nao saiu", async () => {
    fila.enfileirar("cor", bytes(1));
    fila.enfileirar("brilho", bytes(2));
    fila.limpar();
    await vi.advanceTimersByTimeAsync(500);

    expect(escritas).toHaveLength(0);
  });

  // Perder a conexao no meio de uma rajada nao pode travar a fila para sempre.
  it("segue enviando depois de uma escrita que falhou", async () => {
    const ruim = new FilaDeEnvio(
      async (dados) => {
        if (dados[0] === 0xff) throw new Error("Sem conexao");
        escritas.push({ dados, em: Date.now() });
      },
      { intervaloMs: 60, aoFalhar: (e) => falhas.push(e) },
    );

    ruim.enfileirar("a", bytes(0xff));
    ruim.enfileirar("b", bytes(0x01));
    await vi.advanceTimersByTimeAsync(500);

    expect(falhas).toHaveLength(1);
    expect(escritas.map((e) => e.dados[0])).toEqual([0x01]);
  });
});
