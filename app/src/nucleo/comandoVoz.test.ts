import { describe, expect, it } from "vitest";
import {
  descrever,
  extrairComando,
  interpretar,
  normalizar,
  primeiroNumero,
  type ComandoVoz,
} from "./comandoVoz";

describe("normalizar", () => {
  it("tira acento, pontuacao e caixa", () => {
    expect(normalizar("Azul.")).toBe("azul");
    expect(normalizar("  LIGAR   as   luzes! ")).toBe("ligar as luzes");
    expect(normalizar("cinquenta por cento")).toBe("cinquenta por cento");
    expect(normalizar("lilás")).toBe("lilas");
  });

  it("preserva digitos e o sinal de porcento", () => {
    expect(normalizar("50%")).toBe("50%");
    expect(normalizar("cena 3")).toBe("cena 3");
  });
});

describe("primeiroNumero", () => {
  it("le digitos", () => {
    expect(primeiroNumero("brilho 75 por cento")).toBe(75);
    expect(primeiroNumero("cena 2")).toBe(2);
  });

  it("le numero por extenso", () => {
    expect(primeiroNumero("cinquenta")).toBe(50);
    expect(primeiroNumero("quarenta e cinco")).toBe(45);
    expect(primeiroNumero("cem")).toBe(100);
    expect(primeiroNumero("tres")).toBe(3);
    expect(primeiroNumero("dezoito")).toBe(18);
  });

  it("devolve null quando nao ha numero", () => {
    expect(primeiroNumero("cor azul")).toBeNull();
  });
});

describe("interpretar energia", () => {
  it("liga com varios verbos", () => {
    for (const f of ["ligar a luz", "liga as luzes", "acende a luz", "ligue tudo"]) {
      expect(interpretar(f)).toEqual({ tipo: "ligar" });
    }
  });

  it("desliga sem cair no ligar", () => {
    for (const f of ["desligar a luz", "apaga a luz", "desligue as luzes"]) {
      expect(interpretar(f)).toEqual({ tipo: "desligar" });
    }
  });

  it("alterna", () => {
    expect(interpretar("alterna a luz")).toEqual({ tipo: "alternar" });
  });
});

describe("interpretar cor", () => {
  it("reconhece cores simples", () => {
    expect(interpretar("cor azul")).toMatchObject({ tipo: "cor", nome: "azul" });
    expect(interpretar("deixa vermelho")).toMatchObject({ tipo: "cor", nome: "vermelho" });
    expect(interpretar("muda para verde")).toMatchObject({ tipo: "cor", nome: "verde" });
  });

  it("prefere o tom composto ao simples", () => {
    expect(interpretar("azul escuro")).toMatchObject({ tipo: "cor", nome: "azul escuro" });
    expect(interpretar("branco quente")).toMatchObject({ tipo: "cor", nome: "branco quente" });
    expect(interpretar("verde limao")).toMatchObject({ tipo: "cor", nome: "verde limao" });
  });

  it("nao casa cor dentro de outra palavra", () => {
    // "verdade" nao pode virar verde.
    expect(interpretar("isso e verdade")).toMatchObject({ tipo: "desconhecido" });
  });

  it("devolve um rgb utilizavel", () => {
    const c = interpretar("cor vermelha") as Extract<ComandoVoz, { tipo: "cor" }>;
    expect(c.cor).toEqual({ r: 255, g: 0, b: 0 });
  });
});

describe("interpretar brilho", () => {
  it("brilho absoluto por digito e por extenso", () => {
    expect(interpretar("brilho em 50 por cento")).toEqual({ tipo: "brilho", valor: 50 });
    expect(interpretar("coloca o brilho em cinquenta por cento")).toEqual({ tipo: "brilho", valor: 50 });
    expect(interpretar("70%")).toEqual({ tipo: "brilho", valor: 70 });
  });

  it("marcos de brilho", () => {
    expect(interpretar("brilho maximo")).toEqual({ tipo: "brilho", valor: 100 });
    expect(interpretar("brilho minimo")).toEqual({ tipo: "brilho", valor: 1 });
  });

  it("ajuste relativo", () => {
    expect(interpretar("aumenta o brilho")).toEqual({ tipo: "brilhoRelativo", delta: 25 });
    expect(interpretar("diminui a luz")).toEqual({ tipo: "brilhoRelativo", delta: -25 });
    expect(interpretar("mais claro")).toEqual({ tipo: "brilhoRelativo", delta: 25 });
    expect(interpretar("mais escuro")).toEqual({ tipo: "brilhoRelativo", delta: -25 });
  });
});

describe("interpretar cena", () => {
  it("reconhece o numero da cena", () => {
    expect(interpretar("cena 3")).toEqual({ tipo: "cena", indice: 3 });
    expect(interpretar("ativa a cena dois")).toEqual({ tipo: "cena", indice: 2 });
  });

  it("cena tem prioridade sobre brilho quando ha numero", () => {
    expect(interpretar("cena 5")).toEqual({ tipo: "cena", indice: 5 });
  });
});

describe("vocativo no estilo assistente", () => {
  it("ignora o nome de ativacao na frente", () => {
    expect(interpretar("alexa ligar a luz")).toEqual({ tipo: "ligar" });
    expect(interpretar("ok google cor azul")).toMatchObject({ tipo: "cor", nome: "azul" });
    expect(interpretar("casa desligar")).toEqual({ tipo: "desligar" });
  });
});

describe("desconhecido", () => {
  it("marca o que nao entende sem quebrar", () => {
    expect(interpretar("que horas sao")).toMatchObject({ tipo: "desconhecido" });
    expect(interpretar("")).toEqual({ tipo: "desconhecido", texto: "" });
  });
});

describe("extrairComando com palavra de ativacao", () => {
  it("sem palavra, todo texto e comando", () => {
    expect(extrairComando("cor azul", "")).toBe("cor azul");
  });

  it("com palavra, exige o gatilho e devolve o que vem depois", () => {
    expect(extrairComando("casa cor azul", "casa")).toBe("cor azul");
    expect(extrairComando("Casa, cor azul", "casa")).toBe("cor azul");
  });

  it("com palavra ausente, devolve null", () => {
    expect(extrairComando("cor azul", "casa")).toBeNull();
  });
});

describe("descrever", () => {
  it("resume a acao em portugues curto", () => {
    expect(descrever({ tipo: "ligar" })).toBe("Ligado");
    expect(descrever({ tipo: "cor", cor: { r: 0, g: 0, b: 0 }, nome: "azul" })).toBe("Cor azul");
    expect(descrever({ tipo: "brilho", valor: 40 })).toBe("Brilho 40%");
    expect(descrever({ tipo: "cena", indice: 2 })).toBe("Cena 2");
  });
});
