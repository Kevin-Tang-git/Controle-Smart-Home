import type { Transporte } from "./tipos";

/**
 * Aparelho simulado.
 *
 * Aceita os bytes e nao faz nada com eles. Existe para dar para testar o
 * controle de varios aparelhos ao mesmo tempo sem ter varios aparelhos: o
 * estado visivel na interface vem do ControladorFita, que ja e otimista por
 * necessidade (o hardware de verdade tambem nunca responde), entao um
 * aparelho simulado se comporta na tela exatamente como um real.
 */
export class TransporteSimulado implements Transporte {
  readonly conectado = true;
  readonly escritas: Uint8Array[] = [];

  async escrever(dados: Uint8Array): Promise<void> {
    this.escritas.push(new Uint8Array(dados));
  }

  async desconectar(): Promise<void> {
    // Nada a desconectar: nunca houve conexao.
  }
}
