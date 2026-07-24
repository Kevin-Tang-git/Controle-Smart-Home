import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TransporteSimulado } from "../transporte/simulado";
import { GerenciadorAparelhos } from "./aparelhos";

const hex = (dados: Uint8Array) =>
  [...dados].map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");

const escritasDe = (transporte: unknown) => (transporte as TransporteSimulado).escritas;

describe("GerenciadorAparelhos", () => {
  let g: GerenciadorAparelhos;

  beforeEach(() => {
    vi.useFakeTimers();
    g = new GerenciadorAparelhos();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("comeca vazio e com estado neutro", () => {
    expect(g.lista).toHaveLength(0);
    expect(g.estado.ligada).toBe(false);
  });

  it("adiciona simulados ja selecionados e com nome sequencial", () => {
    const a = g.adicionarSimulado();
    const b = g.adicionarSimulado();

    expect(g.lista).toHaveLength(2);
    expect([a.nome, b.nome]).toEqual(["Simulado 1", "Simulado 2"]);
    expect(g.selecionados).toHaveLength(2);
  });

  // O ponto da funcionalidade: um comando, varios aparelhos.
  it("aplica a cor a todos os selecionados de uma vez", async () => {
    const a = g.adicionarSimulado();
    const b = g.adicionarSimulado();

    g.definirCor({ r: 255, g: 0, b: 0 });
    await vi.advanceTimersByTimeAsync(500);

    for (const aparelho of [a, b]) {
      const escritas = escritasDe(aparelho.transporte).map(hex);
      expect(escritas).toContain("7E 00 05 03 FF 00 00 00 EF");
    }
  });

  it("nao toca em aparelho fora da selecao", async () => {
    const dentro = g.adicionarSimulado();
    const fora = g.adicionarSimulado();
    g.alternarSelecao(fora.id);

    g.definirCor({ r: 0, g: 255, b: 0 });
    await vi.advanceTimersByTimeAsync(500);

    expect(escritasDe(dentro.transporte).length).toBeGreaterThan(0);
    expect(escritasDe(fora.transporte)).toHaveLength(0);
  });

  it("selecionar todos e limpar selecao", () => {
    g.adicionarSimulado();
    g.adicionarSimulado();

    g.limparSelecao();
    expect(g.selecionados).toHaveLength(0);

    g.selecionarTodos();
    expect(g.selecionados).toHaveLength(2);
  });

  it("sem selecao, comando nenhum e enviado", async () => {
    const a = g.adicionarSimulado();
    g.limparSelecao();

    g.definirCor({ r: 1, g: 2, b: 3 });
    g.alternarEnergia();
    await vi.advanceTimersByTimeAsync(500);

    expect(escritasDe(a.transporte)).toHaveLength(0);
  });

  // O botao de energia funciona como chave mestra: se algum esta ligado,
  // o toque desliga todos, e nao inverte cada um por conta propria.
  it("energia age como chave mestra sobre a selecao", () => {
    const a = g.adicionarSimulado();
    const b = g.adicionarSimulado();

    g.alternarEnergia();
    expect(g.estado.ligada).toBe(true);
    expect(a.controlador!.estado.ligada).toBe(true);
    expect(b.controlador!.estado.ligada).toBe(true);

    // Desliga so um por fora: o agregado continua "ligado" porque sobrou um.
    b.controlador!.desligar();
    expect(g.estado.ligada).toBe(true);

    g.alternarEnergia();
    expect(a.controlador!.estado.ligada).toBe(false);
    expect(b.controlador!.estado.ligada).toBe(false);
    expect(g.estado.ligada).toBe(false);
  });

  it("o estado mostrado nos controles vem do primeiro selecionado", () => {
    const a = g.adicionarSimulado();
    const b = g.adicionarSimulado();
    a.controlador!.definirCor({ r: 10, g: 20, b: 30 });
    b.controlador!.definirCor({ r: 200, g: 200, b: 200 });

    expect(g.estado.cor).toEqual({ r: 10, g: 20, b: 30 });

    g.alternarSelecao(a.id); // sai da selecao, sobra o b
    expect(g.estado.cor).toEqual({ r: 200, g: 200, b: 200 });
  });

  it("remover tira da lista e da selecao", () => {
    const a = g.adicionarSimulado();
    g.adicionarSimulado();

    g.remover(a.id);

    expect(g.lista).toHaveLength(1);
    expect(g.selecionados).toHaveLength(1);
  });

  it("avisa quem estiver assinando a cada mudanca", () => {
    const ouvinte = vi.fn();
    const cancelar = g.assinar(ouvinte);

    g.adicionarSimulado();
    expect(ouvinte).toHaveBeenCalled();

    const chamadas = ouvinte.mock.calls.length;
    cancelar();
    g.adicionarSimulado();
    expect(ouvinte.mock.calls.length).toBe(chamadas);
  });

  it("salva e restaura os simulados com nome, estado e selecao", () => {
    const a = g.adicionarSimulado("Abajur");
    a.controlador!.definirCor({ r: 7, g: 8, b: 9 });
    a.controlador!.definirBrilho(42);
    g.adicionarSimulado("Nicho");
    g.alternarSelecao(g.lista[1].id);

    const salvos = g.paraSalvar();
    const outro = new GerenciadorAparelhos();
    outro.restaurar(salvos);

    expect(outro.lista.map((x) => x.nome)).toEqual(["Abajur", "Nicho"]);
    expect(outro.lista[0].controlador!.estado.cor).toEqual({ r: 7, g: 8, b: 9 });
    expect(outro.lista[0].controlador!.estado.brilho).toBe(42);
    expect(outro.lista[1].selecionado).toBe(false);
  });

  // Aparelho Bluetooth salvo volta como placeholder: a conexao real depende
  // de permissao do navegador e nao pode ser recriada do nada.
  it("restaura aparelho bluetooth desconectado e sem controlador", () => {
    g.restaurar([
      {
        id: "x1",
        nome: "Fita Quarto",
        tipo: "bluetooth",
        idBluetooth: "abc",
        driverId: "ledble",
        estado: { ligada: true, cor: { r: 1, g: 1, b: 1 }, brilho: 50 },
        selecionado: true,
      },
    ]);

    const [aparelho] = g.lista;
    expect(aparelho.conexao).toBe("desconectado");
    expect(aparelho.controlador).toBeNull();

    // E, sem controlador, ele nao entra na conta dos comandos.
    expect(g.estado.ligada).toBe(false);
  });
});
