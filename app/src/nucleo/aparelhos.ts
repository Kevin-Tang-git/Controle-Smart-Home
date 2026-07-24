import { DRIVER_PADRAO, driverPorId } from "../protocolo/registro";
import type { DriverLed, Rgb } from "../protocolo/tipos";
import { TransporteSimulado } from "../transporte/simulado";
import type { DiagnosticoGatt, EstadoConexao, Transporte } from "../transporte/tipos";
import { TransporteWebBluetooth } from "../transporte/webBluetooth";
import { ControladorFita, ESTADO_INICIAL, type EstadoFita } from "./controlador";

export type TipoAparelho = "bluetooth" | "simulado";

export interface Aparelho {
  id: string;
  nome: string;
  tipo: TipoAparelho;
  conexao: EstadoConexao;
  selecionado: boolean;
  erro: string;
  /** Ausente enquanto o protocolo nao for reconhecido. */
  controlador: ControladorFita | null;
  transporte: Transporte | null;
  /** Preenchido quando nenhum driver conhecido casa com o aparelho. */
  diagnostico: DiagnosticoGatt | null;
  /** Id do dispositivo no navegador, para retomar sem reabrir o seletor. */
  idBluetooth?: string;
  driverId: string | null;
}

/** Forma salva no localStorage. Nao guarda objetos vivos. */
export interface AparelhoSalvo {
  id: string;
  nome: string;
  tipo: TipoAparelho;
  idBluetooth?: string;
  driverId: string | null;
  estado: EstadoFita;
  selecionado: boolean;
}

const novoId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/**
 * Gerencia varios aparelhos e a selecao ativa.
 *
 * A regra da interface: os controles agem sobre os aparelhos SELECIONADOS.
 * Um selecionado significa controle separado, varios selecionados significa
 * controle simultaneo. Nao existe modo especial para nenhum dos dois casos,
 * o que evita a interface ter dois comportamentos para a mesma acao.
 *
 * Estado agregado mostrado nos controles, quando ha varios selecionados:
 *   ligada  = algum deles ligado, para o botao funcionar como chave mestra
 *   cor     = a do primeiro selecionado
 *   brilho  = o do primeiro selecionado
 */
export class GerenciadorAparelhos {
  private _lista: Aparelho[] = [];
  private ouvintes = new Set<() => void>();
  private cancelamentos = new Map<string, () => void>();
  /** Muda a cada alteracao. E o que o React observa. */
  versao = 0;

  constructor(private criarTransporteBluetooth: () => TransporteWebBluetooth = () =>
    new TransporteWebBluetooth()) {}

  get lista(): readonly Aparelho[] {
    return this._lista;
  }

  get selecionados(): Aparelho[] {
    return this._lista.filter((a) => a.selecionado);
  }

  /** Selecionados que realmente conseguem receber comando. */
  private get comandaveis(): Aparelho[] {
    return this.selecionados.filter((a) => a.controlador !== null);
  }

  assinar(ouvinte: () => void): () => void {
    this.ouvintes.add(ouvinte);
    return () => this.ouvintes.delete(ouvinte);
  }

  private avisar(): void {
    this.versao++;
    this.ouvintes.forEach((o) => o());
  }

  private alterar(id: string, mudanca: Partial<Aparelho>): void {
    this._lista = this._lista.map((a) => (a.id === id ? { ...a, ...mudanca } : a));
    this.avisar();
  }

  // ---------------------------------------------------------------------
  // Estado agregado
  // ---------------------------------------------------------------------

  get estado(): EstadoFita {
    const ativos = this.comandaveis;
    if (ativos.length === 0) return { ...ESTADO_INICIAL, cor: { ...ESTADO_INICIAL.cor } };
    const primeiro = ativos[0].controlador!.estado;
    return {
      ligada: ativos.some((a) => a.controlador!.estado.ligada),
      cor: primeiro.cor,
      brilho: primeiro.brilho,
    };
  }

  // ---------------------------------------------------------------------
  // Selecao
  // ---------------------------------------------------------------------

  alternarSelecao(id: string): void {
    const alvo = this._lista.find((a) => a.id === id);
    if (alvo) this.alterar(id, { selecionado: !alvo.selecionado });
  }

  selecionarTodos(): void {
    this._lista = this._lista.map((a) => ({ ...a, selecionado: true }));
    this.avisar();
  }

  limparSelecao(): void {
    this._lista = this._lista.map((a) => ({ ...a, selecionado: false }));
    this.avisar();
  }

  renomear(id: string, nome: string): void {
    this.alterar(id, { nome: nome.trim() || "Aparelho" });
  }

  // ---------------------------------------------------------------------
  // Comandos, aplicados a selecao inteira
  // ---------------------------------------------------------------------

  alternarEnergia(): void {
    const ligar = !this.estado.ligada;
    this.comandaveis.forEach((a) => (ligar ? a.controlador!.ligar() : a.controlador!.desligar()));
    this.avisar();
  }

  definirCor(cor: Rgb): void {
    this.comandaveis.forEach((a) => a.controlador!.definirCor(cor));
    this.avisar();
  }

  definirBrilho(valor: number): void {
    this.comandaveis.forEach((a) => a.controlador!.definirBrilho(valor));
    this.avisar();
  }

  // ---------------------------------------------------------------------
  // Ciclo de vida dos aparelhos
  // ---------------------------------------------------------------------

  adicionarSimulado(nome?: string): Aparelho {
    const quantos = this._lista.filter((a) => a.tipo === "simulado").length;
    const transporte = new TransporteSimulado();
    const aparelho = this.montar({
      id: novoId(),
      nome: nome ?? `Simulado ${quantos + 1}`,
      tipo: "simulado",
      conexao: "conectado",
      driver: DRIVER_PADRAO,
      transporte,
    });
    this._lista = [...this._lista, aparelho];
    this.avisar();
    return aparelho;
  }

  /**
   * Abre o seletor do navegador e adiciona o aparelho escolhido.
   * Precisa ser chamado dentro de um gesto do usuario.
   */
  async adicionarBluetooth(): Promise<void> {
    const transporte = this.criarTransporteBluetooth();
    const id = novoId();
    const provisorio: Aparelho = {
      id,
      nome: "Procurando",
      tipo: "bluetooth",
      conexao: "procurando",
      selecionado: false,
      erro: "",
      controlador: null,
      transporte,
      diagnostico: null,
      driverId: null,
    };
    this._lista = [...this._lista, provisorio];
    this.avisar();

    try {
      await transporte.escolherDispositivo();
      this.alterar(id, { nome: transporte.nomeDispositivo || "Aparelho", conexao: "conectando" });
      const driver = await transporte.conectar();

      if (!driver) {
        // Aparelho novo, protocolo nao reconhecido. Nao e erro: e material
        // para escrever um driver depois.
        this.alterar(id, {
          conexao: "desconhecido",
          diagnostico: transporte.diagnostico,
          idBluetooth: transporte.idDispositivo,
        });
        return;
      }

      const pronto = this.montar({
        id,
        nome: transporte.nomeDispositivo || driver.nome,
        tipo: "bluetooth",
        conexao: "conectado",
        driver,
        transporte,
        idBluetooth: transporte.idDispositivo,
        selecionado: true,
      });
      this._lista = this._lista.map((a) => (a.id === id ? pronto : a));
      this.avisar();
    } catch (erro) {
      // Fechar o seletor sem escolher nada nao e falha: some da lista.
      const cancelado = erro instanceof DOMException && erro.name === "NotFoundError";
      if (cancelado) {
        this.remover(id);
        return;
      }
      this.alterar(id, {
        conexao: "erro",
        erro: erro instanceof Error ? erro.message : String(erro),
      });
    }
  }

  remover(id: string): void {
    const alvo = this._lista.find((a) => a.id === id);
    if (!alvo) return;
    this.cancelamentos.get(id)?.();
    this.cancelamentos.delete(id);
    void alvo.transporte?.desconectar();
    this._lista = this._lista.filter((a) => a.id !== id);
    this.avisar();
  }

  private montar(base: {
    id: string;
    nome: string;
    tipo: TipoAparelho;
    conexao: EstadoConexao;
    driver: DriverLed;
    transporte: Transporte;
    idBluetooth?: string;
    estadoInicial?: EstadoFita;
    selecionado?: boolean;
  }): Aparelho {
    const controlador = new ControladorFita(base.driver, base.transporte, {
      estadoInicial: base.estadoInicial,
      aoFalhar: (e) =>
        this.alterar(base.id, { erro: e instanceof Error ? e.message : String(e) }),
    });

    // Mudanca de estado de qualquer aparelho repinta a interface inteira,
    // porque os controles mostram o agregado da selecao.
    this.cancelamentos.get(base.id)?.();
    this.cancelamentos.set(base.id, controlador.assinar(() => this.avisar()));

    return {
      id: base.id,
      nome: base.nome,
      tipo: base.tipo,
      conexao: base.conexao,
      selecionado: base.selecionado ?? true,
      erro: "",
      controlador,
      transporte: base.transporte,
      diagnostico: null,
      idBluetooth: base.idBluetooth,
      driverId: base.driver.id,
    };
  }

  // ---------------------------------------------------------------------
  // Persistencia
  // ---------------------------------------------------------------------

  paraSalvar(): AparelhoSalvo[] {
    return this._lista
      .filter((a) => a.conexao !== "erro" && a.conexao !== "procurando")
      .map((a) => ({
        id: a.id,
        nome: a.nome,
        tipo: a.tipo,
        idBluetooth: a.idBluetooth,
        driverId: a.driverId,
        estado: a.controlador?.estado ?? { ...ESTADO_INICIAL },
        selecionado: a.selecionado,
      }));
  }

  /**
   * Recria os aparelhos salvos. Os simulados voltam prontos para uso. Os de
   * Bluetooth voltam desconectados: a conexao real depende de permissao do
   * navegador e so pode ser retomada depois, em restaurarConexoes.
   */
  restaurar(salvos: AparelhoSalvo[]): void {
    this._lista = salvos.map((s) => {
      if (s.tipo === "simulado") {
        return this.montar({
          id: s.id,
          nome: s.nome,
          tipo: "simulado",
          conexao: "conectado",
          driver: driverPorId(s.driverId ?? "") ?? DRIVER_PADRAO,
          transporte: new TransporteSimulado(),
          estadoInicial: s.estado,
          selecionado: s.selecionado,
        });
      }
      return {
        id: s.id,
        nome: s.nome,
        tipo: "bluetooth" as const,
        conexao: "desconectado" as const,
        selecionado: s.selecionado,
        erro: "",
        controlador: null,
        transporte: null,
        diagnostico: null,
        idBluetooth: s.idBluetooth,
        driverId: s.driverId,
      };
    });
    this.avisar();
  }

  /**
   * Tenta religar os aparelhos Bluetooth salvos sem abrir o seletor.
   * So funciona com a flag de permissoes novas do Chrome ativa; sem ela o
   * usuario precisa adicionar de novo pelo botao.
   */
  async restaurarConexoes(estadosSalvos: Map<string, EstadoFita>): Promise<void> {
    const pendentes = this._lista.filter(
      (a) => a.tipo === "bluetooth" && a.conexao === "desconectado" && a.idBluetooth,
    );

    for (const aparelho of pendentes) {
      const transporte = this.criarTransporteBluetooth();
      try {
        if (!(await transporte.retomarPorId(aparelho.idBluetooth!))) continue;
        this.alterar(aparelho.id, { conexao: "conectando" });
        const driver = await transporte.conectar();
        if (!driver) {
          this.alterar(aparelho.id, {
            conexao: "desconhecido",
            diagnostico: transporte.diagnostico,
          });
          continue;
        }
        const pronto = this.montar({
          id: aparelho.id,
          nome: aparelho.nome,
          tipo: "bluetooth",
          conexao: "conectado",
          driver,
          transporte,
          idBluetooth: aparelho.idBluetooth,
          estadoInicial: estadosSalvos.get(aparelho.id),
          selecionado: aparelho.selecionado,
        });
        this._lista = this._lista.map((a) => (a.id === aparelho.id ? pronto : a));
        this.avisar();
      } catch {
        // Aparelho fora do alcance ou desligado: fica desconectado na lista,
        // e o usuario reconecta pelo botao quando quiser.
      }
    }
  }
}
