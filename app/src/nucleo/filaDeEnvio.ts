/**
 * Fila de envio com coalescencia.
 *
 * Este e o componente que decide se o app fica bom ou pessimo.
 *
 * Arrastar o dedo no seletor de cor gera centenas de eventos por segundo.
 * O controlador da fita nao aguenta esse volume: ele engasga, ignora
 * comandos e derruba a conexao (foi exatamente o que aconteceu na fase 0
 * quando um quadro longo demais chegou). A regra e no maximo uma escrita a
 * cada intervalo, sempre com o valor MAIS RECENTE, jogando fora os
 * intermediarios que ja nem interessam mais.
 *
 * A coalescencia e por tipo de comando: uma rajada de cor nunca pode
 * atropelar um comando de brilho ou de desligar que chegou no meio. O Map
 * preserva a ordem de insercao e reescrever uma chave existente mantem a
 * posicao original, entao um comando antigo nunca morre de fome.
 */

export type EscritorBytes = (dados: Uint8Array) => Promise<void>;

export interface OpcoesFila {
  /** Intervalo minimo entre duas escritas, em ms. */
  intervaloMs?: number;
  /** Injetavel para teste. */
  relogio?: () => number;
  /** Chamado quando uma escrita falha. */
  aoFalhar?: (erro: unknown) => void;
}

export class FilaDeEnvio {
  private pendentes = new Map<string, Uint8Array>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ultimoEnvio = Number.NEGATIVE_INFINITY;
  private despachando = false;

  private readonly intervaloMs: number;
  private readonly relogio: () => number;
  private readonly aoFalhar: (erro: unknown) => void;

  constructor(private escritor: EscritorBytes, opcoes: OpcoesFila = {}) {
    this.intervaloMs = opcoes.intervaloMs ?? 60;
    this.relogio = opcoes.relogio ?? (() => Date.now());
    this.aoFalhar = opcoes.aoFalhar ?? (() => {});
  }

  /**
   * Enfileira um comando. Se ja houver um pendente do mesmo tipo, o novo
   * substitui o antigo sem perder a posicao na fila.
   */
  enfileirar(tipo: string, dados: Uint8Array): void {
    this.pendentes.set(tipo, dados);
    this.agendar();
  }

  /** Descarta tudo que ainda nao foi enviado. Usado ao desconectar. */
  limpar(): void {
    this.pendentes.clear();
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  get tamanho(): number {
    return this.pendentes.size;
  }

  private agendar(): void {
    if (this.timer !== null || this.despachando) return;
    const desdeUltimo = this.relogio() - this.ultimoEnvio;
    const espera = Math.max(0, this.intervaloMs - desdeUltimo);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.despachar();
    }, espera);
  }

  private async despachar(): Promise<void> {
    const proximo = this.pendentes.entries().next();
    if (proximo.done) return;

    const [tipo, dados] = proximo.value;
    this.pendentes.delete(tipo);
    this.ultimoEnvio = this.relogio();
    this.despachando = true;
    try {
      await this.escritor(dados);
    } catch (erro) {
      this.aoFalhar(erro);
    } finally {
      this.despachando = false;
    }
    if (this.pendentes.size > 0) this.agendar();
  }
}
