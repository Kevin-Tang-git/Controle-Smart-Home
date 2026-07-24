import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DRIVER_PADRAO } from "../protocolo/registro";
import type { Rgb } from "../protocolo/tipos";
import { TransporteWebBluetooth } from "../transporte/webBluetooth";
import type { EstadoConexao } from "../transporte/tipos";
import { carregar, salvar, type Cena } from "./armazenamento";
import { ControladorFita } from "./controlador";

/**
 * Cola entre a interface e o nucleo.
 *
 * Toda a logica de verdade mora em ControladorFita e TransporteWebBluetooth,
 * que sao testados sem React. Aqui so acontece o casamento com o ciclo de
 * vida do componente.
 */
export function useFita() {
  const [conexao, setConexao] = useState<EstadoConexao>("desconectado");
  const [erro, setErro] = useState("");
  const [cenas, setCenas] = useState<Cena[]>(() => carregar().cenas);

  const ref = useRef<{
    transporte: TransporteWebBluetooth;
    controlador: ControladorFita;
  } | null>(null);

  if (ref.current === null) {
    const salvo = carregar();
    const transporte = new TransporteWebBluetooth(DRIVER_PADRAO, () => {
      setConexao("desconectado");
      ref.current?.controlador.abortarPendentes();
    });
    ref.current = {
      transporte,
      controlador: new ControladorFita(DRIVER_PADRAO, transporte, {
        estadoInicial: salvo.estado,
        aoFalhar: (e) => setErro(e instanceof Error ? e.message : String(e)),
      }),
    };
  }
  const { transporte, controlador } = ref.current;

  const estado = useSyncExternalStore(
    useCallback((ouvinte) => controlador.assinar(ouvinte), [controlador]),
    () => controlador.estado,
  );

  useEffect(() => {
    salvar({ estado, cenas });
  }, [estado, cenas]);

  const abrir = useCallback(
    async (escolher: () => Promise<boolean>) => {
      setErro("");
      setConexao("procurando");
      try {
        if (!(await escolher())) {
          setConexao("desconectado");
          return;
        }
        setConexao("conectando");
        await transporte.conectar();
        setConexao("conectado");
      } catch (e) {
        // O usuario fechar o seletor do navegador nao e erro de verdade.
        const cancelado = e instanceof DOMException && e.name === "NotFoundError";
        setConexao(cancelado ? "desconectado" : "erro");
        if (!cancelado) setErro(e instanceof Error ? e.message : String(e));
      }
    },
    [transporte],
  );

  const conectar = useCallback(
    (listarTodos = false) =>
      abrir(async () => {
        await transporte.escolherDispositivo(listarTodos);
        return true;
      }),
    [abrir, transporte],
  );

  const desconectar = useCallback(async () => {
    controlador.abortarPendentes();
    await transporte.desconectar();
    setConexao("desconectado");
  }, [controlador, transporte]);

  // Tenta retomar sozinho um dispositivo ja autorizado, sem abrir o seletor.
  useEffect(() => {
    void abrir(() => transporte.retomarConhecido());
    // Roda uma vez so, na abertura do app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aplicarCena = useCallback(
    (cena: Cena) => {
      controlador.definirCor(cena.cor);
      controlador.definirBrilho(cena.brilho);
    },
    [controlador],
  );

  const gravarCena = useCallback(
    (id: string) => {
      setCenas((atuais) =>
        atuais.map((c) =>
          c.id === id ? { ...c, cor: { ...estado.cor }, brilho: estado.brilho } : c,
        ),
      );
    },
    [estado],
  );

  return {
    estado,
    conexao,
    erro,
    conectado: conexao === "conectado",
    nomeDispositivo: transporte.nomeDispositivo,
    suportado: TransporteWebBluetooth.suportado(),
    conectar,
    desconectar,
    alternar: () => controlador.alternar(),
    definirCor: (cor: Rgb) => controlador.definirCor(cor),
    definirBrilho: (v: number) => controlador.definirBrilho(v),
    cenas,
    aplicarCena,
    gravarCena,
  };
}
