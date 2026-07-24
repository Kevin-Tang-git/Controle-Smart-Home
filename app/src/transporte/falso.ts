import type { Transporte } from "./tipos";

/**
 * Transporte de mentira para os testes.
 *
 * Grava tudo que seria enviado, com o instante de cada escrita, para os
 * testes conseguirem afirmar tanto o conteudo dos bytes quanto o
 * espacamento entre eles.
 */
export class TransporteFalso implements Transporte {
  readonly escritas: { dados: Uint8Array; em: number }[] = [];
  conectado = true;
  /** Se definido, toda escrita rejeita com este erro. */
  falhaForcada: Error | null = null;

  constructor(private relogio: () => number = () => Date.now()) {}

  async escrever(dados: Uint8Array): Promise<void> {
    if (this.falhaForcada) throw this.falhaForcada;
    this.escritas.push({ dados: new Uint8Array(dados), em: this.relogio() });
  }

  async desconectar(): Promise<void> {
    this.conectado = false;
  }

  /** Todas as escritas em hexadecimal, para assercoes legiveis nos testes. */
  get hex(): string[] {
    return this.escritas.map((e) =>
      [...e.dados].map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" "),
    );
  }
}
