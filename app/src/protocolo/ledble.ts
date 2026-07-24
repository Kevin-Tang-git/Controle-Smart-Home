import { byte, porcento, type DriverLed, type Rgb } from "./tipos";

/**
 * Driver LEDBLE.
 *
 * Familia de quadros 7E...EF, variante que escreve em FFE1. NAO confundir
 * com ELK-BLEDOM, que usa os mesmos quadros de cor e brilho mas escreve em
 * FFF3 e tem quadros de ENERGIA diferentes. Essa confusao custou caro aqui:
 * o nome anunciado, os quadros de cor e os de brilho sao identicos nas duas
 * familias, e so o comando de ligar denuncia a diferenca.
 *
 * Identificado na fase 0 contra a fita LEDBLE-00-1A5F (AC:C2:01:70:1A:5F).
 * Ver descobertas/protocolo.json para a evidencia de cada quadro.
 *
 * Todo quadro tem 9 bytes, comeca com 0x7E e termina com 0xEF. O controlador
 * e mudo: aceita os bytes calado e nunca confirma nada. Quadro errado nao da
 * erro, so nao acontece nada, entao a unica validacao possivel e visual.
 *
 * Os quadros de ligar e cor foram vistos funcionando na fita.
 * Os de desligar e brilho vem do catalogo publico e ainda nao foram
 * confirmados no hardware.
 */

const CABECALHO = 0x7e;
const RODAPE = 0xef;

export const ledble: DriverLed = {
  id: "ledble",
  nome: "LEDBLE",
  servico: "0000ffe0-0000-1000-8000-00805f9b34fb",
  caracteristica: "0000ffe1-0000-1000-8000-00805f9b34fb",
  semResposta: true,
  brilhoNativo: true,
  prefixosNome: ["LEDBLE", "ELK-BLE", "ELK-BLEDOM", "ELK-BLEDOB"],

  /**
   * Energia.
   *
   * Este controlador e da familia LEDBLE, nao ELK-BLEDOM. As duas falam
   * quadros 7E...EF, mas a ELK escreve em FFF3 e a LEDBLE em FFE1, e os
   * quadros de energia sao DIFERENTES entre elas. Confundir as duas custou
   * varias rodadas de teste aqui.
   *
   * Quadros que este controlador IGNORA em silencio, ja testados na fita:
   *   7E 00 04 F0 00 01 FF 00 EF   (o ligar mais citado na internet, ELK)
   *   7E 00 04 00 00 01 FF 00 EF   (deducao por espelho do desligar)
   *
   * Fonte da linha LEDBLE, cuja cor e cujo desligar batem byte a byte com o
   * que esta fita confirmou:
   * https://github.com/dave-code-ruiz/elkbledom/blob/main/sniffing_ble_device.md
   */
  ligar(): Uint8Array {
    return new Uint8Array([CABECALHO, 0x00, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, RODAPE]);
  },

  desligar(): Uint8Array {
    return new Uint8Array([CABECALHO, 0x00, 0x04, 0x00, 0x00, 0x00, 0xff, 0x00, RODAPE]);
  },

  cor({ r, g, b }: Rgb): Uint8Array {
    return new Uint8Array([
      CABECALHO, 0x00, 0x05, 0x03, byte(r), byte(g), byte(b), 0x00, RODAPE,
    ]);
  },

  /** Atencao: aqui a escala e 0 a 100, nao 0 a 255 como no RGB. */
  brilho(porcentagem: number): Uint8Array {
    return new Uint8Array([
      CABECALHO, 0x00, 0x01, porcento(porcentagem), 0x00, 0x00, 0x00, 0x00, RODAPE,
    ]);
  },
};
