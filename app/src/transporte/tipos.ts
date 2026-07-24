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
  | "desconhecido"
  | "erro";

/**
 * O que deu para ver de um aparelho cujo protocolo nao foi reconhecido.
 *
 * Limitado de proposito ao que o Web Bluetooth permite: so aparecem os
 * servicos declarados em SERVICOS_SONDAGEM antes de conectar. Serve de
 * materia-prima para escrever um driver novo.
 */
export interface DiagnosticoGatt {
  nomeDispositivo: string;
  servicos: {
    uuid: string;
    caracteristicas: { uuid: string; propriedades: string[] }[];
  }[];
}
