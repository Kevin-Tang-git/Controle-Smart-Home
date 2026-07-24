import { useRef, useState } from "react";
import type { Cena } from "../nucleo/armazenamento";
import { rgbParaCss } from "../nucleo/cores";

const PRESSAO_LONGA_MS = 550;

/**
 * Cenas salvas.
 *
 * Toque curto aplica, toque longo grava a cor e o brilho atuais por cima.
 * Nao ha modo de edicao nem botao de salvar: a gravacao acontece onde o
 * dedo ja esta, que e o que faz sentido num app usado no escuro.
 */
export function Cenas({
  cenas,
  aoAplicar,
  aoGravar,
}: {
  cenas: Cena[];
  aoAplicar: (cena: Cena) => void;
  aoGravar: (id: string) => void;
}) {
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gravou = useRef(false);
  const [gravando, setGravando] = useState<string | null>(null);

  function iniciar(cena: Cena) {
    gravou.current = false;
    temporizador.current = setTimeout(() => {
      gravou.current = true;
      aoGravar(cena.id);
      setGravando(cena.id);
      navigator.vibrate?.(30);
      setTimeout(() => setGravando(null), 400);
    }, PRESSAO_LONGA_MS);
  }

  function soltar(cena: Cena) {
    if (temporizador.current) clearTimeout(temporizador.current);
    if (!gravou.current) aoAplicar(cena);
  }

  function cancelar() {
    if (temporizador.current) clearTimeout(temporizador.current);
    gravou.current = true; // impede que o clique solto aplique a cena
  }

  return (
    <section className="cenas" aria-label="Cenas salvas">
      {cenas.map((cena) => (
        <button
          key={cena.id}
          className={`cena${gravando === cena.id ? " cena-gravada" : ""}`}
          style={{
            background: rgbParaCss(cena.cor),
            opacity: 0.35 + (cena.brilho / 100) * 0.65,
          }}
          onPointerDown={() => iniciar(cena)}
          onPointerUp={() => soltar(cena)}
          onPointerLeave={cancelar}
          onPointerCancel={cancelar}
          onContextMenu={(e) => e.preventDefault()}
          aria-label={`Cena ${cena.id}, brilho ${cena.brilho}%`}
        />
      ))}
      <p className="cenas-dica">Toque para aplicar. Segure para gravar a cor atual.</p>
    </section>
  );
}
