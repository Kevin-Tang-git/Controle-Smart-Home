/**
 * Contrato de transporte: quem leva os bytes ate a fita.
 *
 * Separar isto do driver e o que permite testar todo o app sem hardware:
 * nos testes entra o TransporteFalso, no navegador entra o Web Bluetooth.
 */
export interface Transporte {
  readonly conectado: boolean;
  escrever(dados: Uint8Array): Promise<void>;
  desconectar(): Promise<void>;
}

export type EstadoConexao =
  | "desconectado"
  | "procurando"
  | "conectando"
  | "conectado"
  | "erro";
