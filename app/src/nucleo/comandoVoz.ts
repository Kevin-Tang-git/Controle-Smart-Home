import type { Rgb } from "../protocolo/tipos";

/**
 * Interpretador de comando de voz. Logica pura, sem DOM e sem Web Speech,
 * para poder ser testada byte por byte como o resto do nucleo.
 *
 * A gramatica imita a de Alexa e Google Home em portugues: um vocativo
 * opcional no comeco ("ok casa", "alexa", "assistente") seguido de uma
 * intencao curta ("ligar a luz", "cor azul", "brilho em cinquenta por cento",
 * "cena tres"). O vocativo e ignorado aqui; quem exige palavra de ativacao
 * e o chamador, atraves de extrairComando.
 */

export type ComandoVoz =
  | { tipo: "ligar" }
  | { tipo: "desligar" }
  | { tipo: "alternar" }
  | { tipo: "cor"; cor: Rgb; nome: string }
  /** Brilho absoluto, 0 a 100. */
  | { tipo: "brilho"; valor: number }
  /** Ajuste relativo ao brilho atual, ex: +25 ou -25. */
  | { tipo: "brilhoRelativo"; delta: number }
  /** Numero da cena falado, base 1 ("cena tres" => 3). */
  | { tipo: "cena"; indice: number }
  | { tipo: "desconhecido"; texto: string };

/**
 * Baixa o texto para uma forma comparavel: minusculo, sem acento e com
 * espacos colapsados. O reconhecedor as vezes devolve "Azul.", as vezes
 * "azul", entao normalizar antes de comparar evita casos de borda bobos.
 */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9%\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Vocativos que um usuario naturalmente joga na frente do comando, no estilo
// dos assistentes de casa. Sao descartados para que "alexa, ligar a luz" e
// "ligar a luz" cheguem no mesmo lugar.
const VOCATIVOS = [
  "ok google",
  "ei google",
  "e google",
  "google",
  "alexa",
  "assistente",
  "computador",
  "casa",
  "ok",
];

function tirarVocativo(texto: string): string {
  let t = texto;
  for (const v of VOCATIVOS) {
    if (t === v) return "";
    if (t.startsWith(v + " ")) {
      t = t.slice(v.length + 1);
      break;
    }
  }
  return t.trim();
}

/**
 * Cores nomeadas em portugues.
 *
 * A ordem importa: os nomes compostos ("azul escuro", "verde limao") vem
 * antes dos simples ("azul", "verde"), senao "azul escuro" casaria no "azul"
 * e perderia o tom. A busca para no primeiro apelido encontrado como palavra
 * inteira.
 */
interface CorNomeada {
  nome: string;
  rgb: Rgb;
  apelidos: string[];
}

export const CORES_NOMEADAS: CorNomeada[] = [
  { nome: "branco quente", rgb: { r: 255, g: 180, b: 107 }, apelidos: ["branco quente", "luz quente", "quente", "ambar", "dourado", "dourada"] },
  { nome: "branco frio", rgb: { r: 200, g: 225, b: 255 }, apelidos: ["branco frio", "luz fria", "frio", "gelo"] },
  { nome: "branco", rgb: { r: 255, g: 255, b: 255 }, apelidos: ["branco", "branca"] },
  { nome: "vermelho", rgb: { r: 255, g: 0, b: 0 }, apelidos: ["vermelho", "vermelha", "sangue"] },
  { nome: "laranja", rgb: { r: 255, g: 110, b: 0 }, apelidos: ["laranja"] },
  { nome: "amarelo", rgb: { r: 255, g: 220, b: 0 }, apelidos: ["amarelo", "amarela"] },
  { nome: "verde limao", rgb: { r: 160, g: 255, b: 0 }, apelidos: ["verde limao", "limao"] },
  { nome: "verde", rgb: { r: 0, g: 255, b: 0 }, apelidos: ["verde"] },
  { nome: "ciano", rgb: { r: 0, g: 200, b: 255 }, apelidos: ["ciano", "turquesa", "azul piscina"] },
  { nome: "azul claro", rgb: { r: 0, g: 150, b: 255 }, apelidos: ["azul claro", "azul bebe"] },
  { nome: "azul escuro", rgb: { r: 0, g: 0, b: 180 }, apelidos: ["azul escuro", "azul marinho", "marinho"] },
  { nome: "azul", rgb: { r: 40, g: 80, b: 255 }, apelidos: ["azul"] },
  { nome: "roxo", rgb: { r: 150, g: 0, b: 255 }, apelidos: ["roxo", "roxa", "violeta", "uva"] },
  { nome: "lilas", rgb: { r: 200, g: 150, b: 255 }, apelidos: ["lilas", "lavanda"] },
  { nome: "magenta", rgb: { r: 255, g: 0, b: 200 }, apelidos: ["magenta"] },
  { nome: "rosa", rgb: { r: 255, g: 80, b: 180 }, apelidos: ["rosa choque", "rosa", "pink"] },
  { nome: "marrom", rgb: { r: 120, g: 50, b: 20 }, apelidos: ["marrom", "cafe"] },
];

function contemPalavra(texto: string, alvo: string): boolean {
  // Palavra (ou frase) inteira, para "verde" nao casar dentro de "verdade".
  const escapado = alvo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escapado}($|\\s)`).test(texto);
}

function acharCor(texto: string): CorNomeada | null {
  for (const cor of CORES_NOMEADAS) {
    if (cor.apelidos.some((a) => contemPalavra(texto, a))) return cor;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Numeros por extenso, 0 a 100. O reconhecedor tanto pode devolver "50"
// quanto "cinquenta", entao os dois caminhos precisam funcionar.
// ---------------------------------------------------------------------------

const UNIDADES: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
  quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19,
};

const DEZENAS: Record<string, number> = {
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60,
  setenta: 70, oitenta: 80, noventa: 90,
};

/** Primeiro numero encontrado no texto, em digitos ou por extenso. */
export function primeiroNumero(texto: string): number | null {
  const digito = texto.match(/\d+/);
  if (digito) return Number(digito[0]);

  const palavras = texto.split(" ");
  for (let i = 0; i < palavras.length; i++) {
    const p = palavras[i];
    if (p === "cem" || p === "cento") return 100;
    if (p in DEZENAS) {
      // "quarenta e cinco" => 45; "quarenta" sozinho => 40.
      const proxima = palavras[i + 1] === "e" ? palavras[i + 2] : palavras[i + 1];
      if (proxima && proxima in UNIDADES && UNIDADES[proxima] < 10) {
        return DEZENAS[p] + UNIDADES[proxima];
      }
      return DEZENAS[p];
    }
    if (p in UNIDADES) return UNIDADES[p];
  }
  return null;
}

// Passo padrao de um ajuste relativo de brilho ("aumenta a luz").
const PASSO_BRILHO = 25;

const RE_DESLIGAR = /\b(desliga|desligar|desligue|apaga|apagar|apague|desativa|desativar)\b/;
const RE_LIGAR = /\b(liga|ligar|ligue|acende|acender|acenda|ativa|ativar)\b/;
const RE_BRILHO = /\b(brilho|claridade|intensidade|luminosidade)\b/;
const RE_MAIS = /\b(aumenta|aumentar|sobe|subir|clareia|clarear|mais)\b/;
const RE_MENOS = /\b(diminui|diminuir|abaixa|abaixar|reduz|reduzir|baixa|escurece|escurecer|menos)\b/;

/**
 * Traduz uma transcricao em intencao. Nao decide se ha palavra de ativacao,
 * isso e responsabilidade de extrairComando; aqui o texto ja chega limpo do
 * vocativo.
 *
 * A ordem de teste e deliberada. Desligar vem antes de ligar porque
 * "desligar" contem "ligar". Cena vem antes de brilho porque as duas usam
 * numero, e "cena tres" nao pode virar "brilho 3".
 */
export function interpretar(bruto: string): ComandoVoz {
  const texto = tirarVocativo(normalizar(bruto));
  if (!texto) return { tipo: "desconhecido", texto: "" };

  // Cena, antes de qualquer coisa que leia numero.
  if (/\b(cena|cenario|preset|modo)\b/.test(texto)) {
    const n = primeiroNumero(texto);
    if (n !== null && n >= 1) return { tipo: "cena", indice: n };
  }

  // Energia.
  if (RE_DESLIGAR.test(texto)) return { tipo: "desligar" };
  if (/\b(alterna|alternar|inverte|inverter)\b/.test(texto)) return { tipo: "alternar" };

  // Brilho. Um pedido de brilho pode ser absoluto ("brilho em cinquenta"),
  // por marco ("brilho maximo") ou relativo ("aumenta o brilho").
  const falaDeBrilho = RE_BRILHO.test(texto) || /\bpor cento\b/.test(texto) || texto.includes("%");
  if (falaDeBrilho || RE_MAIS.test(texto) || RE_MENOS.test(texto)) {
    if (/\b(maximo|maxima|total|tudo)\b/.test(texto)) return { tipo: "brilho", valor: 100 };
    if (/\b(minimo|minima)\b/.test(texto)) return { tipo: "brilho", valor: 1 };

    const n = primeiroNumero(texto);
    if (n !== null && (falaDeBrilho || /\bpor cento\b/.test(texto) || texto.includes("%"))) {
      return { tipo: "brilho", valor: n };
    }
    // O adjetivo manda mais que o verbo: "mais escuro" abaixa, mesmo tendo "mais".
    if (/\b(escuro|escura|fraco|fraca)\b/.test(texto)) return { tipo: "brilhoRelativo", delta: -PASSO_BRILHO };
    if (/\b(claro|clara|forte)\b/.test(texto)) return { tipo: "brilhoRelativo", delta: PASSO_BRILHO };
    if (RE_MENOS.test(texto)) return { tipo: "brilhoRelativo", delta: -PASSO_BRILHO };
    if (RE_MAIS.test(texto)) return { tipo: "brilhoRelativo", delta: PASSO_BRILHO };
  }

  // Cor nomeada.
  const cor = acharCor(texto);
  if (cor) return { tipo: "cor", cor: { ...cor.rgb }, nome: cor.nome };

  // Ligar por ultimo: "acende a luz" nao deve roubar um "acende vermelho".
  if (RE_LIGAR.test(texto)) return { tipo: "ligar" };

  return { tipo: "desconhecido", texto };
}

/**
 * Aplica a regra da palavra de ativacao. Sem palavra configurada, todo texto
 * e comando (o usuario ja ligou a escuta de proposito). Com palavra, o texto
 * precisa conte-la, e so o que vem depois dela e interpretado, como num
 * assistente de casa: "casa, cor azul" => "cor azul".
 */
export function extrairComando(bruto: string, palavraAtivacao: string): string | null {
  const texto = normalizar(bruto);
  const gatilho = normalizar(palavraAtivacao);
  if (!gatilho) return texto;

  const idx = texto.indexOf(gatilho);
  if (idx === -1) return null;
  return texto.slice(idx + gatilho.length).trim();
}

/** Frase curta de confirmacao, no tom seco de um assistente. */
export function descrever(c: ComandoVoz): string {
  switch (c.tipo) {
    case "ligar":
      return "Ligado";
    case "desligar":
      return "Desligado";
    case "alternar":
      return "Alternado";
    case "cor":
      return `Cor ${c.nome}`;
    case "brilho":
      return `Brilho ${c.valor}%`;
    case "brilhoRelativo":
      return c.delta >= 0 ? "Mais brilho" : "Menos brilho";
    case "cena":
      return `Cena ${c.indice}`;
    case "desconhecido":
      return "Nao entendi";
  }
}
