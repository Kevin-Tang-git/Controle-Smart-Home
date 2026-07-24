import { BotaoVoz } from "./componentes/BotaoVoz";
import { Cenas } from "./componentes/Cenas";
import { FaixaAparelhos } from "./componentes/FaixaAparelhos";
import { RodaDeCor } from "./componentes/RodaDeCor";
import type { Aparelho } from "./nucleo/aparelhos";
import { rgbParaCss, rgbParaHex } from "./nucleo/cores";
import { useAparelhos } from "./nucleo/useAparelhos";
import { useVoz } from "./nucleo/useVoz";

/**
 * Painel de protocolo desconhecido.
 *
 * Quando um aparelho novo nao casa com nenhum driver, isso aqui e o que
 * sobra de util: os servicos e caracteristicas que o navegador deixou ver.
 * E o bastante para escrever um driver depois, sem precisar do PC.
 */
function Desconhecido({ aparelho }: { aparelho: Aparelho }) {
  const d = aparelho.diagnostico;
  return (
    <section className="desconhecido">
      <h2>{aparelho.nome}: protocolo desconhecido</h2>
      <p>
        Conectou, mas nenhum driver conhecido reconheceu este aparelho. Abaixo esta o que
        o navegador deixou ver. Mande isso para escrevermos o driver.
      </p>
      {d && d.servicos.length > 0 ? (
        <ul>
          {d.servicos.map((s) => (
            <li key={s.uuid}>
              <code>{s.uuid}</code>
              <ul>
                {s.caracteristicas.map((c) => (
                  <li key={c.uuid}>
                    <code>{c.uuid}</code> <span>[{c.propriedades.join(", ")}]</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p className="desconhecido-vazio">
          Nenhum serviço conhecido encontrado. O navegador só enxerga serviços declarados
          de antemão, então este aparelho usa um UUID fora da nossa lista. Descobrir qual
          exige rodar <code>tools/dump.py</code> uma vez, pelo computador.
        </p>
      )}
    </section>
  );
}

export default function App() {
  const app = useAparelhos();
  const voz = useVoz(app.executarComando);
  const { estado } = app;
  const semAlvo = app.comandaveis === 0;
  const desconhecidos = app.lista.filter((a) => a.conexao === "desconhecido");

  if (!app.suportado) {
    return (
      <main className="tela">
        <div className="aviso">
          <h1>Sem Bluetooth no navegador</h1>
          <p>
            Este app usa Web Bluetooth, que existe no Chrome e no Edge, no computador e no
            Android. O Safari do iPhone não tem suporte.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="tela"
      style={{
        // O fundo respira a cor atual: confirmacao visual mesmo com os
        // aparelhos fora do campo de visao.
        ["--cor-atual" as string]: rgbParaCss(estado.cor),
        ["--brilho-atual" as string]: String(estado.brilho / 100),
      }}
    >
      <FaixaAparelhos
        lista={app.lista}
        aoAlternar={app.alternarSelecao}
        aoRemover={app.remover}
        aoRenomear={app.renomear}
        aoSelecionarTodos={app.selecionarTodos}
        aoLimparSelecao={app.limparSelecao}
        aoAdicionarBluetooth={() => void app.adicionarBluetooth()}
        aoAdicionarSimulado={app.adicionarSimulado}
      />

      {desconhecidos.map((a) => (
        <Desconhecido key={a.id} aparelho={a} />
      ))}

      <BotaoVoz voz={voz} />

      <div className={`controles${semAlvo ? " controles-inertes" : ""}`}>
        <button
          className={`energia${estado.ligada ? " energia-ligada" : ""}`}
          onClick={app.alternarEnergia}
          disabled={semAlvo}
          aria-pressed={estado.ligada}
        >
          <span className="energia-simbolo" aria-hidden="true" />
          <span className="energia-texto">{estado.ligada ? "Ligada" : "Desligada"}</span>
        </button>

        <RodaDeCor cor={estado.cor} aoMudar={app.definirCor} />

        <label className="brilho">
          <span className="brilho-topo">
            <span>Brilho</span>
            <span className="brilho-valor">{estado.brilho}%</span>
          </span>
          <input
            type="range"
            min={1}
            max={100}
            value={estado.brilho}
            disabled={semAlvo}
            onChange={(e) => app.definirBrilho(Number(e.target.value))}
          />
        </label>

        <Cenas cenas={app.cenas} aoAplicar={app.aplicarCena} aoGravar={app.gravarCena} />
      </div>

      {semAlvo && (
        <p className="dica">
          {app.lista.length === 0
            ? "Toque em + aparelho para conectar por Bluetooth, ou + simulado para experimentar sem hardware."
            : "Selecione ao menos um aparelho conectado para comandar."}
        </p>
      )}

      <footer className="rodape">
        <code>{rgbParaHex(estado.cor)}</code>
        <span>
          {app.comandaveis > 0
            ? `comandando ${app.comandaveis} ${app.comandaveis === 1 ? "aparelho" : "aparelhos"}`
            : "nada selecionado"}
        </span>
      </footer>
    </main>
  );
}
