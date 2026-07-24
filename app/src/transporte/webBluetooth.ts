import { DRIVER_PADRAO, servicosConhecidos } from "../protocolo/registro";
import type { DriverLed } from "../protocolo/tipos";
import type { Transporte } from "./tipos";

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Transporte real via Web Bluetooth.
 *
 * Cada detalhe estranho aqui veio de uma falha observada na fase 0:
 *
 * 1. A fita NAO anuncia o UUID do servico no pacote de advertising. Filtrar
 *    por servico nunca acha o dispositivo, entao o filtro e por prefixo de
 *    nome, com uma saida de emergencia que lista tudo.
 * 2. Escritas disparadas logo apos o connect somem sem erro. Por isso a
 *    pausa antes de liberar o transporte.
 * 3. O primeiro gatt.connect() falha com alguma frequencia, entao ha
 *    tentativa repetida.
 * 4. O controlador e mudo: nao adianta ler nada de volta para confirmar.
 */
export class TransporteWebBluetooth implements Transporte {
  private dispositivo: BluetoothDevice | null = null;
  private caracteristica: BluetoothRemoteGATTCharacteristic | null = null;

  constructor(
    private driver: DriverLed = DRIVER_PADRAO,
    private aoPerderConexao: () => void = () => {},
  ) {}

  static suportado(): boolean {
    return typeof navigator !== "undefined" && "bluetooth" in navigator;
  }

  get conectado(): boolean {
    return Boolean(this.dispositivo?.gatt?.connected && this.caracteristica);
  }

  get nomeDispositivo(): string {
    return this.dispositivo?.name ?? "";
  }

  /**
   * Abre o seletor do navegador. Precisa ser chamado dentro de um gesto do
   * usuario (clique), exigencia da propria API.
   */
  async escolherDispositivo(listarTodos = false): Promise<void> {
    const opcoes: RequestDeviceOptions = listarTodos
      ? { acceptAllDevices: true, optionalServices: servicosConhecidos() }
      : {
          filters: [
            ...this.driver.prefixosNome.map((namePrefix) => ({ namePrefix })),
            { services: [this.driver.servico] },
          ],
          optionalServices: servicosConhecidos(),
        };
    this.adotar(await navigator.bluetooth.requestDevice(opcoes));
  }

  /**
   * Tenta retomar um dispositivo ja autorizado antes, sem abrir o seletor.
   * Depende da flag chrome://flags/#enable-web-bluetooth-new-permissions-backend.
   * Sem ela, getDevices nao existe e o app cai no seletor manual.
   */
  async retomarConhecido(): Promise<boolean> {
    if (typeof navigator.bluetooth?.getDevices !== "function") return false;
    const conhecidos = await navigator.bluetooth.getDevices();
    if (conhecidos.length === 0) return false;
    this.adotar(conhecidos[0]);
    return true;
  }

  private adotar(dispositivo: BluetoothDevice): void {
    this.dispositivo = dispositivo;
    dispositivo.addEventListener("gattserverdisconnected", () => {
      this.caracteristica = null;
      this.aoPerderConexao();
    });
  }

  async conectar(tentativas = 3): Promise<void> {
    if (!this.dispositivo?.gatt) {
      throw new Error("Nenhum dispositivo escolhido ainda.");
    }
    let ultimoErro: unknown = null;
    for (let i = 1; i <= tentativas; i++) {
      try {
        const servidor = await this.dispositivo.gatt.connect();
        const servico = await servidor.getPrimaryService(this.driver.servico);
        this.caracteristica = await servico.getCharacteristic(this.driver.caracteristica);
        // O modulo serial descarta o que chega logo depois do connect.
        await pausa(800);
        return;
      } catch (erro) {
        ultimoErro = erro;
        await pausa(400 * i);
      }
    }
    throw ultimoErro instanceof Error
      ? ultimoErro
      : new Error("Nao foi possivel conectar na fita.");
  }

  async escrever(dados: Uint8Array): Promise<void> {
    const c = this.caracteristica;
    if (!c) throw new Error("Sem conexao com a fita.");
    const hex = [...dados].map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
    if (import.meta.env.DEV) console.debug("[fita] enviando", hex);
    try {
      if (this.driver.semResposta && typeof c.writeValueWithoutResponse === "function") {
        await c.writeValueWithoutResponse(dados as BufferSource);
      } else {
        await c.writeValue(dados as BufferSource);
      }
      if (import.meta.env.DEV) console.debug("[fita] ok", hex);
    } catch (erro) {
      if (import.meta.env.DEV) console.error("[fita] falhou", hex, erro);
      throw erro;
    }
  }

  async desconectar(): Promise<void> {
    this.caracteristica = null;
    if (this.dispositivo?.gatt?.connected) this.dispositivo.gatt.disconnect();
  }
}
