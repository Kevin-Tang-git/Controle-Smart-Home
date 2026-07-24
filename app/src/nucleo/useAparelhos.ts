import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Rgb } from "../protocolo/tipos";
import { porcento } from "../protocolo/tipos";
import { TransporteWebBluetooth } from "../transporte/webBluetooth";
import { GerenciadorAparelhos } from "./aparelhos";
import { carregar, salvar, type Cena } from "./armazenamento";
import { descrever, type ComandoVoz } from "./comandoVoz";
import type { EstadoFita } from "./controlador";

/** Resultado de um comando de voz, ja pronto para virar toast e fala. */
export interface ResultadoComando {
  ok: boolean;
  texto: string;
}

/**
 * Cola entre a interface e o nucleo.
 *
 * Toda a logica de verdade mora em GerenciadorAparelhos e nos transportes,
 * que sao testados sem React. Aqui so acontece o casamento com o ciclo de
 * vida do componente.
 */
export function useAparelhos() {
  const [cenas, setCenas] = useState<Cena[]>(() => carregar().cenas);
  const gerenciadorRef = useRef<GerenciadorAparelhos | null>(null);

  if (gerenciadorRef.current === null) {
    const g = new GerenciadorAparelhos();
    const salvos = carregar().aparelhos;
    if (salvos.length > 0) g.restaurar(salvos);
    gerenciadorRef.current = g;
  }
  const gerenciador = gerenciadorRef.current;

  // A versao muda a cada alteracao em qualquer aparelho. E o gatilho de
  // repintura: os controles mostram o agregado da selecao, entao mudanca
  // em um aparelho pode mudar o que a tela inteira exibe.
  useSyncExternalStore(
    useCallback((ouvinte) => gerenciador.assinar(ouvinte), [gerenciador]),
    () => gerenciador.versao,
  );

  const lista = gerenciador.lista;
  const estado = gerenciador.estado;

  useEffect(() => {
    salvar({ aparelhos: gerenciador.paraSalvar(), cenas });
  }, [gerenciador, gerenciador.versao, cenas]);

  // Tenta religar sozinho os aparelhos Bluetooth ja autorizados antes.
  useEffect(() => {
    const estados = new Map<string, EstadoFita>(
      carregar().aparelhos.map((a) => [a.id, a.estado]),
    );
    void gerenciador.restaurarConexoes(estados);
    // Roda uma vez so, na abertura do app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aplicarCena = useCallback(
    (cena: Cena) => {
      gerenciador.definirCor(cena.cor);
      gerenciador.definirBrilho(cena.brilho);
    },
    [gerenciador],
  );

  const gravarCena = useCallback(
    (id: string) => {
      setCenas((atuais) =>
        atuais.map((c) =>
          c.id === id ? { ...c, cor: { ...estado.cor }, brilho: estado.brilho } : c,
        ),
      );
    },
    [estado],
  );

  // Ponte entre a intencao reconhecida na voz e as acoes do gerenciador. Fica
  // aqui, perto da logica do app, porque precisa da selecao atual e das cenas.
  const executarComando = useCallback(
    (c: ComandoVoz): ResultadoComando => {
      if (c.tipo === "desconhecido") return { ok: false, texto: descrever(c) };

      const temAlvo = gerenciador.selecionados.some((a) => a.controlador);
      if (!temAlvo) return { ok: false, texto: "Nenhum aparelho selecionado" };

      switch (c.tipo) {
        case "ligar":
          gerenciador.ligar();
          break;
        case "desligar":
          gerenciador.desligar();
          break;
        case "alternar":
          gerenciador.alternarEnergia();
          break;
        case "cor":
          gerenciador.definirCor(c.cor);
          break;
        case "brilho":
          gerenciador.definirBrilho(c.valor);
          break;
        case "brilhoRelativo":
          gerenciador.definirBrilho(porcento(gerenciador.estado.brilho + c.delta));
          break;
        case "cena": {
          const cena = cenas[c.indice - 1];
          if (!cena) return { ok: false, texto: `Cena ${c.indice} nao existe` };
          aplicarCena(cena);
          break;
        }
      }
      return { ok: true, texto: descrever(c) };
    },
    [gerenciador, cenas, aplicarCena],
  );

  return {
    lista,
    estado,
    cenas,
    suportado: TransporteWebBluetooth.suportado(),
    selecionados: gerenciador.selecionados.length,
    comandaveis: gerenciador.selecionados.filter((a) => a.controlador).length,

    adicionarBluetooth: () => gerenciador.adicionarBluetooth(),
    adicionarSimulado: () => gerenciador.adicionarSimulado(),
    remover: (id: string) => gerenciador.remover(id),
    renomear: (id: string, nome: string) => gerenciador.renomear(id, nome),
    alternarSelecao: (id: string) => gerenciador.alternarSelecao(id),
    selecionarTodos: () => gerenciador.selecionarTodos(),
    limparSelecao: () => gerenciador.limparSelecao(),

    alternarEnergia: () => gerenciador.alternarEnergia(),
    definirCor: (cor: Rgb) => gerenciador.definirCor(cor),
    definirBrilho: (v: number) => gerenciador.definirBrilho(v),
    aplicarCena,
    gravarCena,
    executarComando,
  };
}
