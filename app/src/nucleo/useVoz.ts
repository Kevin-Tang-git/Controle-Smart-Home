import { useCallback, useEffect, useRef, useState } from "react";
import { ReconhecimentoVoz } from "../transporte/reconhecimentoVoz";
import { extrairComando, interpretar, type ComandoVoz } from "./comandoVoz";
import type { ResultadoComando } from "./useAparelhos";

/**
 * Cola entre o reconhecimento de voz e as acoes do app.
 *
 * A logica de verdade mora em comandoVoz (interpretar) e no ReconhecimentoVoz,
 * ambos testaveis sem React. Aqui so acontece o ciclo de vida: guardar a
 * configuracao, casar transcricao com comando e dar o retorno em tela e em voz.
 */

export interface ConfigVoz {
  /** Vazio: toda fala vira comando. Preenchido: exige o gatilho, estilo Alexa. */
  palavraAtivacao: string;
  /** Confirma a acao falando de volta, como um assistente de casa. */
  confirmarVoz: boolean;
}

// Confirmacao falada vem desligada: a mudanca de cor na tela e na fita ja e a
// confirmacao. Fica como opcao em ajustes para quem quiser a voz de volta.
const CONFIG_PADRAO: ConfigVoz = { palavraAtivacao: "", confirmarVoz: false };
const CHAVE = "fita-led/voz";

function carregarConfig(): ConfigVoz {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return CONFIG_PADRAO;
    const lido = JSON.parse(cru) as Partial<ConfigVoz>;
    return {
      palavraAtivacao: typeof lido.palavraAtivacao === "string" ? lido.palavraAtivacao : "",
      confirmarVoz: lido.confirmarVoz === true,
    };
  } catch {
    return CONFIG_PADRAO;
  }
}

const MENSAGEM_ERRO: Record<string, string> = {
  "not-allowed": "Permissao de microfone negada. Libere o microfone e tente de novo.",
  "service-not-allowed": "O navegador bloqueou o microfone neste contexto.",
  "sem-suporte": "Este navegador nao reconhece voz.",
  network: "Sem rede para o reconhecimento de voz.",
  "audio-capture": "Nenhum microfone encontrado.",
};

function falar(texto: string): void {
  try {
    const sintese = window.speechSynthesis;
    if (!sintese) return;
    const fala = new SpeechSynthesisUtterance(texto);
    fala.lang = "pt-BR";
    fala.rate = 1.05;
    sintese.cancel();
    sintese.speak(fala);
  } catch {
    // Sem sintese de voz: a confirmacao visual ja basta.
  }
}

export interface Feedback {
  texto: string;
  ok: boolean;
  /** Muda a cada acao, para a UI reanimar o toast mesmo repetindo o texto. */
  chave: number;
}

export function useVoz(executarComando: (c: ComandoVoz) => ResultadoComando) {
  const [suportado] = useState(() => ReconhecimentoVoz.suportado());
  const [ouvindo, setOuvindo] = useState(false);
  const [ultimoTexto, setUltimoTexto] = useState("");
  const [erro, setErro] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [config, setConfig] = useState<ConfigVoz>(carregarConfig);

  // Os callbacks do reconhecimento sao presos uma vez so; para enxergarem a
  // configuracao e a acao mais recentes sem recriar o motor, passam por refs.
  const executarRef = useRef(executarComando);
  const configRef = useRef(config);
  executarRef.current = executarComando;
  configRef.current = config;

  const reconhecimentoRef = useRef<ReconhecimentoVoz | null>(null);
  const contadorRef = useRef(0);

  const processar = useCallback((texto: string) => {
    const cfg = configRef.current;
    const comandoTexto = extrairComando(texto, cfg.palavraAtivacao);
    // Palavra de ativacao exigida e ausente: ignora em silencio.
    if (comandoTexto === null) return;

    const comando = interpretar(comandoTexto);
    // Sem palavra de ativacao, som de fundo nao entendido nao vira ruido na
    // tela: so reage ao que virou acao. Com palavra, o usuario enderecou de
    // proposito, entao vale avisar que nao entendeu.
    if (comando.tipo === "desconhecido" && !cfg.palavraAtivacao) return;

    const resultado = executarRef.current(comando);
    contadorRef.current += 1;
    setFeedback({ texto: resultado.texto, ok: resultado.ok, chave: contadorRef.current });
    if (cfg.confirmarVoz && (resultado.ok || cfg.palavraAtivacao)) falar(resultado.texto);
  }, []);

  const processarRef = useRef(processar);
  processarRef.current = processar;

  if (reconhecimentoRef.current === null && suportado) {
    reconhecimentoRef.current = new ReconhecimentoVoz({
      aoTexto: (texto, final) => {
        setUltimoTexto(texto);
        if (final) processarRef.current(texto);
      },
      aoErro: (codigo, fatal) => {
        setErro(MENSAGEM_ERRO[codigo] ?? `Falha no reconhecimento (${codigo}).`);
        if (fatal) setOuvindo(false);
      },
      aoIniciar: () => {
        setErro("");
        setOuvindo(true);
      },
      aoParar: () => setOuvindo(false),
    });
  }

  // Solta o microfone ao desmontar, para nao ficar ouvindo em segundo plano.
  useEffect(() => () => reconhecimentoRef.current?.parar(), []);

  const alternarEscuta = useCallback(() => {
    const rec = reconhecimentoRef.current;
    if (!rec) return;
    if (rec.ouvindo) {
      rec.parar();
    } else {
      setUltimoTexto("");
      setErro("");
      rec.iniciar();
    }
  }, []);

  const atualizarConfig = useCallback((mudanca: Partial<ConfigVoz>) => {
    setConfig((atual) => {
      const novo = { ...atual, ...mudanca };
      try {
        localStorage.setItem(CHAVE, JSON.stringify(novo));
      } catch {
        // Modo privado: perder a preferencia nao pode quebrar o app.
      }
      return novo;
    });
  }, []);

  return {
    suportado,
    ouvindo,
    ultimoTexto,
    erro,
    feedback,
    config,
    alternarEscuta,
    atualizarConfig,
  };
}

/** Tudo que o hook de voz expoe, para tipar a UI sem repetir a forma. */
export type VozApi = ReturnType<typeof useVoz>;
