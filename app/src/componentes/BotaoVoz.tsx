import { useState } from "react";
import { CORES_NOMEADAS } from "../nucleo/comandoVoz";
import type { VozApi } from "../nucleo/useVoz";

/**
 * Controle por voz, no estilo de um assistente de casa.
 *
 * Toda a logica vive em useVoz e em comandoVoz. Aqui e so o microfone, o que
 * esta sendo ouvido, a confirmacao da ultima acao e os ajustes. Os comandos
 * agem sobre os aparelhos selecionados, igual aos controles de baixo.
 */
export function BotaoVoz({ voz }: { voz: VozApi }) {
  const [ajustes, setAjustes] = useState(false);

  if (!voz.suportado) {
    return (
      <section className="voz voz-sem-suporte" aria-label="Controle por voz">
        <p>
          Reconhecimento de voz indisponível neste navegador. Funciona no Chrome e no Edge,
          no computador e no Android.
        </p>
      </section>
    );
  }

  const dica = voz.config.palavraAtivacao
    ? `diga "${voz.config.palavraAtivacao}, ligar a luz"`
    : "fale um comando";

  return (
    <section className="voz" aria-label="Controle por voz">
      <div className="voz-linha">
        <button
          className={`voz-mic${voz.ouvindo ? " voz-mic-ativo" : ""}`}
          onClick={voz.alternarEscuta}
          aria-pressed={voz.ouvindo}
          aria-label={voz.ouvindo ? "Parar de ouvir" : "Ouvir comando de voz"}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z"
            />
            <path
              fill="currentColor"
              d="M19 12a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V21a1 1 0 1 0 2 0v-2.08A7 7 0 0 0 19 12Z"
            />
          </svg>
        </button>

        <div className="voz-estado">
          <span className="voz-rotulo">
            {voz.ouvindo ? "Ouvindo…" : "Toque no microfone e fale"}
          </span>
          <span className="voz-texto">
            {voz.ouvindo ? voz.ultimoTexto || dica : " "}
          </span>
          {voz.feedback && (
            <span
              key={voz.feedback.chave}
              className={`voz-feedback${voz.feedback.ok ? "" : " voz-feedback-erro"}`}
            >
              {voz.feedback.texto}
            </span>
          )}
        </div>

        <button
          className="link"
          onClick={() => setAjustes((a) => !a)}
          aria-expanded={ajustes}
        >
          ajustes
        </button>
      </div>

      {voz.erro && <p className="voz-erro">{voz.erro}</p>}

      {ajustes && (
        <div className="voz-ajustes">
          <label className="voz-campo">
            <span>Palavra de ativação</span>
            <input
              type="text"
              value={voz.config.palavraAtivacao}
              placeholder="opcional, ex: casa"
              autoCapitalize="none"
              onChange={(e) => voz.atualizarConfig({ palavraAtivacao: e.target.value })}
            />
          </label>
          <p className="voz-dica-campo">
            Em branco, toda fala vira comando enquanto o microfone estiver ligado. Preenchida,
            só reage depois de ouvir a palavra, como um assistente de casa.
          </p>

          <label className="voz-check">
            <input
              type="checkbox"
              checked={voz.config.confirmarVoz}
              onChange={(e) => voz.atualizarConfig({ confirmarVoz: e.target.checked })}
            />
            <span>Confirmar a ação em voz</span>
          </label>

          <p className="voz-dica">
            Diga: <b>ligar a luz</b>, <b>cor azul</b>, <b>brilho em 50 por cento</b>,{" "}
            <b>aumenta o brilho</b>, <b>cena 3</b>, <b>desligar</b>.
          </p>
          <p className="voz-dica voz-dica-cores">
            Cores: {CORES_NOMEADAS.map((c) => c.nome).join(", ")}.
          </p>
        </div>
      )}
    </section>
  );
}
