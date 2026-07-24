import { Cenas } from "./componentes/Cenas";
import { RodaDeCor } from "./componentes/RodaDeCor";
import { rgbParaCss, rgbParaHex } from "./nucleo/cores";
import { useFita } from "./nucleo/useFita";
import { DRIVER_PADRAO } from "./protocolo/registro";

const ROTULO_CONEXAO: Record<string, string> = {
  desconectado: "Desconectada",
  procurando: "Procurando",
  conectando: "Conectando",
  conectado: "Conectada",
  erro: "Falhou",
};

export default function App() {
  const fita = useFita();
  const { estado, conexao, conectado } = fita;
  const corCss = rgbParaCss(estado.cor);

  if (!fita.suportado) {
    return (
      <main className="tela">
        <div className="aviso">
          <h1>Sem Bluetooth no navegador</h1>
          <p>
            Este app usa Web Bluetooth, que existe no Chrome e no Edge, no
            computador e no Android. O Safari do iPhone nao tem suporte.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="tela"
      style={{
        // O fundo respira a cor atual: confirmacao visual mesmo com a fita
        // fora do campo de visao.
        ["--cor-atual" as string]: corCss,
        ["--brilho-atual" as string]: String(estado.brilho / 100),
      }}
    >
      <header className="barra">
        <span className={`selo selo-${conexao}`}>
          {ROTULO_CONEXAO[conexao] ?? conexao}
          {conectado && fita.nomeDispositivo ? `: ${fita.nomeDispositivo}` : ""}
        </span>
        {conectado ? (
          <button className="link" onClick={() => void fita.desconectar()}>
            desconectar
          </button>
        ) : (
          <button
            className="link"
            onClick={() => void fita.conectar()}
            disabled={conexao === "procurando" || conexao === "conectando"}
          >
            conectar
          </button>
        )}
      </header>

      {(conexao === "erro" || fita.erro) && (
        <p className="erro">
          {fita.erro}
          <button className="link" onClick={() => void fita.conectar(true)}>
            listar todos os dispositivos
          </button>
        </p>
      )}

      <button
        className={`energia${estado.ligada ? " energia-ligada" : ""}`}
        onClick={fita.alternar}
        aria-pressed={estado.ligada}
      >
        <span className="energia-simbolo" aria-hidden="true" />
        <span className="energia-texto">{estado.ligada ? "Ligada" : "Desligada"}</span>
      </button>

      <RodaDeCor cor={estado.cor} aoMudar={fita.definirCor} />

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
          onChange={(e) => fita.definirBrilho(Number(e.target.value))}
        />
      </label>

      <Cenas cenas={fita.cenas} aoAplicar={fita.aplicarCena} aoGravar={fita.gravarCena} />

      <footer className="rodape">
        <code>{rgbParaHex(estado.cor)}</code>
        <span>{DRIVER_PADRAO.nome}</span>
      </footer>
    </main>
  );
}
