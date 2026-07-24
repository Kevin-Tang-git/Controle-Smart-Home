import { useState } from "react";
import type { Aparelho } from "../nucleo/aparelhos";
import { rgbParaCss } from "../nucleo/cores";

const ROTULO: Record<string, string> = {
  desconectado: "desconectado",
  procurando: "procurando",
  conectando: "conectando",
  conectado: "",
  desconhecido: "protocolo desconhecido",
  erro: "falhou",
};

/**
 * Faixa de aparelhos com selecao.
 *
 * Tocar seleciona ou tira da selecao. Os controles abaixo agem sobre o que
 * estiver selecionado: um aparelho e controle separado, varios e controle
 * simultaneo, sem precisar de modo nenhum.
 */
export function FaixaAparelhos({
  lista,
  aoAlternar,
  aoRemover,
  aoRenomear,
  aoSelecionarTodos,
  aoLimparSelecao,
  aoAdicionarBluetooth,
  aoAdicionarSimulado,
}: {
  lista: readonly Aparelho[];
  aoAlternar: (id: string) => void;
  aoRemover: (id: string) => void;
  aoRenomear: (id: string, nome: string) => void;
  aoSelecionarTodos: () => void;
  aoLimparSelecao: () => void;
  aoAdicionarBluetooth: () => void;
  aoAdicionarSimulado: () => void;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const selecionados = lista.filter((a) => a.selecionado).length;

  return (
    <section className="aparelhos" aria-label="Aparelhos">
      <div className="aparelhos-faixa">
        {lista.map((aparelho) => {
          const estado = aparelho.controlador?.estado;
          const cor = estado ? rgbParaCss(estado.cor) : "#3a3f4d";
          const nota = ROTULO[aparelho.conexao] ?? aparelho.conexao;

          return (
            <div
              key={aparelho.id}
              className={`chip${aparelho.selecionado ? " chip-ativo" : ""}${
                aparelho.controlador ? "" : " chip-inerte"
              }`}
            >
              <button
                className="chip-corpo"
                onClick={() => aoAlternar(aparelho.id)}
                onDoubleClick={() => setEditando(aparelho.id)}
                aria-pressed={aparelho.selecionado}
                title="Toque para selecionar, toque duplo para renomear"
              >
                <span
                  className="chip-cor"
                  style={{
                    background: cor,
                    opacity: estado?.ligada === false ? 0.25 : 1,
                  }}
                />
                {editando === aparelho.id ? (
                  <input
                    className="chip-nome-editando"
                    defaultValue={aparelho.nome}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      aoRenomear(aparelho.id, e.target.value);
                      setEditando(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") setEditando(null);
                    }}
                  />
                ) : (
                  <span className="chip-nome">{aparelho.nome}</span>
                )}
                {nota && <span className="chip-nota">{nota}</span>}
                {aparelho.tipo === "simulado" && <span className="chip-nota">simulado</span>}
              </button>
              <button
                className="chip-remover"
                onClick={() => aoRemover(aparelho.id)}
                aria-label={`Remover ${aparelho.nome}`}
              >
                &times;
              </button>
            </div>
          );
        })}

        <button className="chip chip-adicionar" onClick={aoAdicionarBluetooth}>
          + aparelho
        </button>
      </div>

      <div className="aparelhos-acoes">
        {lista.length > 0 && (
          <>
            <button className="link" onClick={aoSelecionarTodos}>
              todos
            </button>
            <button className="link" onClick={aoLimparSelecao}>
              nenhum
            </button>
            <span className="aparelhos-conta">
              {selecionados === 0
                ? "nenhum selecionado"
                : selecionados === 1
                  ? "1 selecionado"
                  : `${selecionados} selecionados`}
            </span>
          </>
        )}
        <button className="link link-discreto" onClick={aoAdicionarSimulado}>
          + simulado
        </button>
      </div>
    </section>
  );
}
