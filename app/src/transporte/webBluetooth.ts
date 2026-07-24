import { DRIVERS, SERVICOS_SONDAGEM } from "../protocolo/registro";
import type { DriverLed } from "../protocolo/tipos";
import type { DiagnosticoGatt, Transporte } from "./tipos";

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Converte o objeto de propriedades do Web Bluetooth em lista legivel. */
function propriedades(c: BluetoothRemoteGATTCharacteristic): string[] {
  const p = c.properties;
  return (
    [
      ["read", p.read],
      ["write", p.write],
      ["write-without-response", p.writeWithoutResponse],
      ["notify", p.notify],
      ["indicate", p.indicate],
    ] as const
  )
    .filter(([, tem]) => tem)
    .map(([nome]) => nome);
}

/**
 * Transporte real via Web Bluetooth.
 *
 * Cada detalhe estranho aqui veio de uma falha observada na fase 0:
 *
 * 1. A fita NAO anuncia o UUID do servico no pacote de advertising. Filtrar
 *    por servico nunca acha o dispositivo, entao o seletor lista tudo.
 * 2. Escritas disparadas logo apos o connect somem sem erro. Por isso a
 *    pausa antes de liberar o transporte.
 * 3. O primeiro gatt.connect() falha com alguma frequencia, entao ha
 *    tentativa repetida.
 * 4. O controlador e mudo: nao adianta ler nada de volta para confirmar.
 */
export class TransporteWebBluetooth implements Transporte {
  private dispositivo: BluetoothDevice | null = null;
  private caracteristica: BluetoothRemoteGATTCharacteristic | null = null;
  private _driver: DriverLed | null = null;
  private _diagnostico: DiagnosticoGatt | null = null;

  constructor(private aoPerderConexao: () => void = () => {}) {}

  static suportado(): boolean {
    return typeof navigator !== "undefined" && "bluetooth" in navigator;
  }

  get conectado(): boolean {
    return Boolean(this.dispositivo?.gatt?.connected && this.caracteristica);
  }

  get driver(): DriverLed | null {
    return this._driver;
  }

  /** Preenchido quando nenhum driver conhecido casa com o aparelho. */
  get diagnostico(): DiagnosticoGatt | null {
    return this._diagnostico;
  }

  get nomeDispositivo(): string {
    return this.dispositivo?.name ?? "";
  }

  get idDispositivo(): string {
    return this.dispositivo?.id ?? "";
  }

  /**
   * Abre o seletor do navegador. Precisa ser chamado dentro de um gesto do
   * usuario (clique), exigencia da propria API.
   */
  async escolherDispositivo(): Promise<void> {
    this.adotar(
      await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [...SERVICOS_SONDAGEM],
      }),
    );
  }

  /**
   * Retoma um aparelho ja autorizado antes, sem abrir o seletor. Depende da
   * flag chrome://flags/#enable-web-bluetooth-new-permissions-backend.
   */
  async retomarPorId(id: string): Promise<boolean> {
    if (typeof navigator.bluetooth?.getDevices !== "function") return false;
    const encontrado = (await navigator.bluetooth.getDevices()).find((d) => d.id === id);
    if (!encontrado) return false;
    this.adotar(encontrado);
    return true;
  }

  private adotar(dispositivo: BluetoothDevice): void {
    this.dispositivo = dispositivo;
    dispositivo.addEventListener("gattserverdisconnected", () => {
      this.caracteristica = null;
      this.aoPerderConexao();
    });
  }

  /**
   * Conecta e identifica o protocolo.
   *
   * Devolve o driver reconhecido, ou null quando nenhum casa. Nesse caso o
   * diagnostico fica preenchido com o que deu para ver do aparelho, que e o
   * material para escrever um driver novo depois.
   */
  async conectar(tentativas = 3): Promise<DriverLed | null> {
    if (!this.dispositivo?.gatt) throw new Error("Nenhum aparelho escolhido ainda.");

    let ultimoErro: unknown = null;
    for (let i = 1; i <= tentativas; i++) {
      try {
        const servidor = await this.dispositivo.gatt.connect();
        await this.identificar(servidor);
        // O modulo serial descarta o que chega logo depois do connect.
        await pausa(800);
        return this._driver;
      } catch (erro) {
        ultimoErro = erro;
        await pausa(400 * i);
      }
    }
    throw ultimoErro instanceof Error
      ? ultimoErro
      : new Error("Nao foi possivel conectar no aparelho.");
  }

  private async identificar(servidor: BluetoothRemoteGATTServer): Promise<void> {
    // getPrimaryServices so devolve o que foi declarado em optionalServices:
    // o navegador nao permite varrer servicos arbitrarios.
    let servicos: BluetoothRemoteGATTService[] = [];
    try {
      servicos = await servidor.getPrimaryServices();
    } catch {
      servicos = [];
    }

    const presentes = new Set(servicos.map((s) => s.uuid.toLowerCase()));
    const driver = DRIVERS.find((d) => presentes.has(d.servico.toLowerCase()));

    if (driver) {
      const servico = await servidor.getPrimaryService(driver.servico);
      this.caracteristica = await servico.getCharacteristic(driver.caracteristica);
      this._driver = driver;
      this._diagnostico = null;
      return;
    }

    // Protocolo desconhecido: junta o que deu para ver, para virar driver
    // depois. A interface mostra isso em vez de falhar calada.
    this._driver = null;
    this.caracteristica = null;
    this._diagnostico = {
      nomeDispositivo: this.nomeDispositivo,
      servicos: await Promise.all(
        servicos.map(async (s) => ({
          uuid: s.uuid,
          caracteristicas: await s
            .getCharacteristics()
            .then((cs) => cs.map((c) => ({ uuid: c.uuid, propriedades: propriedades(c) })))
            .catch(() => []),
        })),
      ),
    };
  }

  async escrever(dados: Uint8Array): Promise<void> {
    const c = this.caracteristica;
    if (!c) throw new Error("Sem conexao com o aparelho.");
    if (this._driver?.semResposta && c.properties.writeWithoutResponse) {
      await c.writeValueWithoutResponse(dados as BufferSource);
    } else {
      await c.writeValue(dados as BufferSource);
    }
  }

  async desconectar(): Promise<void> {
    this.caracteristica = null;
    if (this.dispositivo?.gatt?.connected) this.dispositivo.gatt.disconnect();
  }
}
