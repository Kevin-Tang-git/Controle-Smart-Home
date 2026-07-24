import { useEffect, useRef } from "react";
import { hsvParaRgb, rgbParaHsv } from "../nucleo/cores";
import type { Rgb } from "../protocolo/tipos";

const TAMANHO = 300;

/**
 * Roda de cor HSV.
 *
 * Angulo e matiz, distancia do centro e saturacao. O valor fica fixo em 1
 * porque escurecer e trabalho do slider de brilho, que viaja ate a fita por
 * um comando proprio.
 *
 * O arrasto dispara centenas de eventos por segundo de proposito: quem
 * segura o tranco e a FilaDeEnvio, que envia so o ultimo valor de cada
 * janela. A interface pode ser generosa porque o transporte e disciplinado.
 */
export function RodaDeCor({
  cor,
  aoMudar,
}: {
  cor: Rgb;
  aoMudar: (cor: Rgb) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const imagem = ctx.createImageData(TAMANHO, TAMANHO);
    const raio = TAMANHO / 2;

    for (let y = 0; y < TAMANHO; y++) {
      for (let x = 0; x < TAMANHO; x++) {
        const dx = x - raio;
        const dy = y - raio;
        const distancia = Math.sqrt(dx * dx + dy * dy) / raio;
        const i = (y * TAMANHO + x) * 4;

        if (distancia > 1) {
          imagem.data[i + 3] = 0;
          continue;
        }

        const angulo = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        const { r, g, b } = hsvParaRgb({ h: angulo, s: distancia, v: 1 });
        imagem.data[i] = r;
        imagem.data[i + 1] = g;
        imagem.data[i + 2] = b;
        // Suaviza so a ultima fatia de pixel da borda, para nao serrilhar.
        imagem.data[i + 3] = distancia > 0.98 ? Math.round((1 - distancia) * 50 * 255) : 255;
      }
    }
    ctx.putImageData(imagem, 0, 0);
  }, []);

  const { h, s } = rgbParaHsv(cor);
  const anguloRad = ((h - 90) * Math.PI) / 180;
  const marcador = {
    left: `${50 + Math.cos(anguloRad) * s * 50}%`,
    top: `${50 + Math.sin(anguloRad) * s * 50}%`,
  };

  function escolher(evento: React.PointerEvent<HTMLDivElement>) {
    const caixa = evento.currentTarget.getBoundingClientRect();
    const raio = caixa.width / 2;
    const dx = evento.clientX - caixa.left - raio;
    const dy = evento.clientY - caixa.top - raio;

    const distancia = Math.min(1, Math.sqrt(dx * dx + dy * dy) / raio);
    const angulo = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    aoMudar(hsvParaRgb({ h: angulo, s: distancia, v: 1 }));
  }

  return (
    <div
      className="roda"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        escolher(e);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) escolher(e);
      }}
      role="application"
      aria-label="Seletor de cor"
    >
      <canvas ref={canvasRef} width={TAMANHO} height={TAMANHO} />
      <span className="roda-marcador" style={marcador} />
    </div>
  );
}
