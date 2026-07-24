import type { Rgb } from "../protocolo/tipos";
import type { AparelhoSalvo } from "./aparelhos";

/**
 * Persistencia local.
 *
 * Os controladores sao mudos e nunca informam em que estado estao, entao a
 * unica memoria do sistema e esta aqui. Guardar no localStorage e o que faz
 * o app reabrir mostrando os mesmos aparelhos e as mesmas cores.
 */

const CHAVE = "fita-led/v2";

export interface Cena {
  id: string;
  cor: Rgb;
  brilho: number;
}

export interface DadosSalvos {
  aparelhos: AparelhoSalvo[];
  cenas: Cena[];
}

export const CENAS_PADRAO: Cena[] = [
  { id: "1", cor: { r: 255, g: 180, b: 107 }, brilho: 70 },
  { id: "2", cor: { r: 255, g: 255, b: 255 }, brilho: 100 },
  { id: "3", cor: { r: 255, g: 0, b: 0 }, brilho: 100 },
  { id: "4", cor: { r: 255, g: 110, b: 0 }, brilho: 100 },
  { id: "5", cor: { r: 0, g: 255, b: 60 }, brilho: 100 },
  { id: "6", cor: { r: 0, g: 200, b: 255 }, brilho: 100 },
  { id: "7", cor: { r: 40, g: 0, b: 255 }, brilho: 100 },
  { id: "8", cor: { r: 255, g: 0, b: 200 }, brilho: 60 },
];

function padrao(): DadosSalvos {
  return {
    aparelhos: [],
    cenas: CENAS_PADRAO.map((c) => ({ ...c, cor: { ...c.cor } })),
  };
}

/** Nunca lanca: dado corrompido vira o padrao, o app precisa abrir sempre. */
export function carregar(): DadosSalvos {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return padrao();
    const lido = JSON.parse(cru) as Partial<DadosSalvos>;
    const base = padrao();
    return {
      aparelhos: Array.isArray(lido.aparelhos) ? lido.aparelhos : [],
      cenas: Array.isArray(lido.cenas) && lido.cenas.length > 0 ? lido.cenas : base.cenas,
    };
  } catch {
    return padrao();
  }
}

export function salvar(dados: DadosSalvos): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(dados));
  } catch {
    // Modo privado ou cota estourada: perder a memoria nao pode quebrar o app.
  }
}
