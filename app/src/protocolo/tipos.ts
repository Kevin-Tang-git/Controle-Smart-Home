/**
 * Contrato de um driver de fita LED.
 *
 * Um driver e uma funcao pura: recebe intencao (ligar, pintar de vermelho)
 * e devolve os bytes exatos que a fita entende. Nao sabe nada de Bluetooth,
 * nao faz IO, nao guarda estado. Por isso e 100% testavel sem hardware.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface DriverLed {
  /** Chave curta usada no armazenamento local e no registro. */
  readonly id: string;
  /** Nome legivel, aparece na interface. */
  readonly nome: string;
  /** UUID do servico GATT a pedir no filtro do Web Bluetooth. */
  readonly servico: string;
  /** UUID da caracteristica onde os comandos sao escritos. */
  readonly caracteristica: string;
  /** Se true, escrever com writeValueWithoutResponse. */
  readonly semResposta: boolean;
  /**
   * Prefixos de nome usados so para filtrar a lista do seletor de
   * dispositivos. Nao servem para deduzir protocolo: a fase 0 provou que o
   * nome LEDBLE, tipico da familia Triones, estava numa fita ELK-BLEDOM.
   */
  readonly prefixosNome: readonly string[];
  /**
   * Se false, o controlador nao tem comando de brilho proprio e o app
   * precisa simular escalando o RGB antes de enviar a cor.
   */
  readonly brilhoNativo: boolean;

  ligar(): Uint8Array;
  desligar(): Uint8Array;
  cor(rgb: Rgb): Uint8Array;
  /** Brilho em porcentagem, 0 a 100. Retorna null se nao houver suporte. */
  brilho(porcentagem: number): Uint8Array | null;
}

/**
 * Prende um numero na faixa e devolve inteiro.
 *
 * Existe porque seletor de cor produz float e slider produz string: sem
 * isso, um valor como 255.4 ou -1 viraria byte invalido e o quadro inteiro
 * seria rejeitado pela fita, sem nenhum erro visivel (o controlador e mudo).
 */
export function byte(valor: number): number {
  // So NaN precisa de guarda: Math.min/max ja saturam +-Infinity no limite
  // certo, que e o comportamento desejado para um valor estourado.
  if (Number.isNaN(valor)) return 0;
  return Math.min(255, Math.max(0, Math.round(valor)));
}

/** Prende uma porcentagem entre 0 e 100, como inteiro. */
export function porcento(valor: number): number {
  if (Number.isNaN(valor)) return 0;
  return Math.min(100, Math.max(0, Math.round(valor)));
}

/**
 * Escala uma cor por um brilho percentual.
 * Usado como plano B quando o controlador nao tem brilho nativo.
 */
export function escalarRgb(rgb: Rgb, porcentagem: number): Rgb {
  const fator = porcento(porcentagem) / 100;
  return {
    r: byte(rgb.r * fator),
    g: byte(rgb.g * fator),
    b: byte(rgb.b * fator),
  };
}
