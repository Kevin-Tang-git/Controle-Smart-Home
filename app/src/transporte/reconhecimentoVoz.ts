/**
 * Reconhecimento de voz do navegador, isolado atras de uma classe pequena,
 * do mesmo jeito que o Web Bluetooth fica atras do seu transporte.
 *
 * Usa a Web Speech API (webkitSpeechRecognition no Chrome e no Edge, os
 * mesmos navegadores que tem Web Bluetooth, entao o par combina). A API nao
 * vem tipada na lib padrao do TypeScript, entao o minimo necessario esta
 * declarado aqui embaixo.
 *
 * Detalhe honesto: no Chrome o audio e processado nos servidores do Google.
 * Nada e gravado pelo app e nao ha conta nem chave, mas quem quiser tudo
 * dentro de casa deve deixar a escuta desligada, que e o padrao.
 */

interface FalaResultado {
  readonly transcript: string;
  readonly confidence: number;
}
interface FalaAlternativas {
  readonly length: number;
  readonly isFinal: boolean;
  item(indice: number): FalaResultado;
  [indice: number]: FalaResultado;
}
interface FalaListaResultados {
  readonly length: number;
  item(indice: number): FalaAlternativas;
  [indice: number]: FalaAlternativas;
}
interface FalaEvento extends Event {
  readonly resultIndex: number;
  readonly results: FalaListaResultados;
}
interface FalaEventoErro extends Event {
  readonly error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: FalaEvento) => void) | null;
  onerror: ((e: FalaEventoErro) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type ConstrutorReconhecimento = new () => SpeechRecognitionLike;

function construtor(): ConstrutorReconhecimento | null {
  const w = window as unknown as {
    SpeechRecognition?: ConstrutorReconhecimento;
    webkitSpeechRecognition?: ConstrutorReconhecimento;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface OpcoesVoz {
  /** Recebe cada transcricao. `final` distingue o resultado fechado do parcial. */
  aoTexto: (texto: string, final: boolean) => void;
  /** Erro tratavel. `fatal` marca os que nao adianta reiniciar, como permissao negada. */
  aoErro: (codigo: string, fatal: boolean) => void;
  aoIniciar?: () => void;
  aoParar?: () => void;
  lang?: string;
}

export class ReconhecimentoVoz {
  private rec: SpeechRecognitionLike | null = null;
  /** Intencao do usuario: continuar ouvindo. Guia o reinicio automatico. */
  private ativo = false;

  static suportado(): boolean {
    return construtor() !== null;
  }

  constructor(private opcoes: OpcoesVoz) {}

  get ouvindo(): boolean {
    return this.ativo;
  }

  iniciar(): void {
    if (this.ativo) return;
    const Rec = construtor();
    if (!Rec) {
      this.opcoes.aoErro("sem-suporte", true);
      return;
    }
    this.ativo = true;
    this.abrir(Rec);
  }

  private abrir(Rec: ConstrutorReconhecimento): void {
    const rec = new Rec();
    rec.lang = this.opcoes.lang ?? "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => this.opcoes.aoIniciar?.();

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const alt = e.results[i];
        const texto = alt[0]?.transcript ?? "";
        if (texto.trim()) this.opcoes.aoTexto(texto, alt.isFinal);
      }
    };

    rec.onerror = (e) => {
      // "no-speech" e "aborted" sao rotina em escuta continua: silencio ou o
      // proprio stop. Nao valem alarme; o onend cuida de religar se preciso.
      const rotina = e.error === "no-speech" || e.error === "aborted";
      const fatal = e.error === "not-allowed" || e.error === "service-not-allowed";
      if (fatal) this.ativo = false;
      if (!rotina) this.opcoes.aoErro(e.error, fatal);
    };

    rec.onend = () => {
      // O motor encerra sozinho depois de um tempo de fala ou de silencio.
      // Enquanto o usuario quiser ouvir, reabre. E o que da a sensacao de
      // escuta sempre ligada, como num assistente de casa.
      if (this.ativo) {
        try {
          rec.start();
        } catch {
          this.reabrirDepois(Rec);
        }
      } else {
        this.opcoes.aoParar?.();
      }
    };

    this.rec = rec;
    try {
      rec.start();
    } catch {
      // start() logo apos um end() as vezes reclama que ja comecou. Espera um
      // batimento e tenta de novo, sem derrubar a intencao de ouvir.
      this.reabrirDepois(Rec);
    }
  }

  private reabrirDepois(Rec: ConstrutorReconhecimento): void {
    setTimeout(() => {
      if (this.ativo) this.abrir(Rec);
    }, 300);
  }

  parar(): void {
    this.ativo = false;
    if (this.rec) {
      try {
        this.rec.stop();
      } catch {
        // Ja parado: nada a fazer.
      }
    }
  }
}
