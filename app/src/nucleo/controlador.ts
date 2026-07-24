import { escalarRgb, porcento, type DriverLed, type Rgb } from "../protocolo/tipos";
import type { Transporte } from "../transporte/tipos";
import { FilaDeEnvio } from "./filaDeEnvio";

export interface EstadoFita {
  ligada: boolean;
  cor: Rgb;
  /** 0 a 100. */
  brilho: number;
}

export const ESTADO_INICIAL: EstadoFita = {
  ligada: false,
  cor: { r: 255, g: 255, b: 255 },
  brilho: 100,
};

/**
 * Controlador da fita: junta driver, transporte e fila.
 *
 * O modelo aqui e OTIMISTA de proposito. O controlador da fita nunca
 * responde nada (fase 0 confirmou: seis consultas de status conhecidas,
 * zero respostas), entao esperar confirmacao deixaria a interface travada
 * para sempre. O estado muda na hora e o comando sai pela fila.
 */
export class ControladorFita {
  private ouvintes = new Set<() => void>();
  private fila: FilaDeEnvio;
  private _estado: EstadoFita;

  constructor(
    private driver: DriverLed,
    private transporte: Transporte,
    opcoes: {
      intervaloMs?: number;
      estadoInicial?: EstadoFita;
      relogio?: () => number;
      /**
       * Obrigatorio na pratica: sem isto, uma escrita que falha desaparece
       * sem deixar rastro e o app parece so estar ignorando o usuario.
       */
      aoFalhar?: (erro: unknown) => void;
    } = {},
  ) {
    this._estado = opcoes.estadoInicial ?? { ...ESTADO_INICIAL, cor: { ...ESTADO_INICIAL.cor } };
    this.fila = new FilaDeEnvio((dados) => this.transporte.escrever(dados), {
      intervaloMs: opcoes.intervaloMs,
      relogio: opcoes.relogio,
      aoFalhar: opcoes.aoFalhar,
    });
  }

  get estado(): EstadoFita {
    return this._estado;
  }

  assinar(ouvinte: () => void): () => void {
    this.ouvintes.add(ouvinte);
    return () => this.ouvintes.delete(ouvinte);
  }

  private mudar(parcial: Partial<EstadoFita>): void {
    this._estado = { ...this._estado, ...parcial };
    this.ouvintes.forEach((o) => o());
  }

  ligar(): void {
    this.mudar({ ligada: true });
    this.fila.enfileirar("energia", this.driver.ligar());
    // Reafirma cor e brilho: alguns controladores voltam no ultimo estado
    // interno, que nao e necessariamente o que a interface mostra.
    this.enviarCor();
    this.enviarBrilho();
  }

  desligar(): void {
    this.mudar({ ligada: false });
    this.fila.enfileirar("energia", this.driver.desligar());
  }

  alternar(): void {
    if (this._estado.ligada) this.desligar();
    else this.ligar();
  }

  definirCor(cor: Rgb): void {
    this.mudar({ cor, ligada: true });
    this.enviarCor();
  }

  definirBrilho(valor: number): void {
    const brilho = porcento(valor);
    this.mudar({ brilho, ligada: true });
    if (this.driver.brilhoNativo) this.enviarBrilho();
    // Sem brilho nativo, o brilho vive dentro da propria cor.
    else this.enviarCor();
  }

  private enviarCor(): void {
    const { cor, brilho } = this._estado;
    const efetiva = this.driver.brilhoNativo ? cor : escalarRgb(cor, brilho);
    this.fila.enfileirar("cor", this.driver.cor(efetiva));
  }

  private enviarBrilho(): void {
    const quadro = this.driver.brilho(this._estado.brilho);
    if (quadro) this.fila.enfileirar("brilho", quadro);
  }

  /** Descarta comandos pendentes. Chamar ao perder a conexao. */
  abortarPendentes(): void {
    this.fila.limpar();
  }
}
