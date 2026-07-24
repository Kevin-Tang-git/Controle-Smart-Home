"""
Gera os icones do PWA.

O icone e a mesma roda de cor da interface sobre o fundo escuro do app,
para o atalho na tela inicial ser reconhecivel de relance.

Uso:
    .venv\\Scripts\\python.exe tools\\gerar_icones.py
"""
import colorsys
import math
import os
import sys

from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, "app", "public")

FUNDO = (8, 9, 13, 255)
SUPERAMOSTRAGEM = 4  # desenha grande e reduz, para a borda sair lisa


def desenhar_roda(lado: int, fracao_raio: float) -> Image.Image:
    """Roda HSV centrada, ocupando fracao_raio do lado da imagem."""
    grande = lado * SUPERAMOSTRAGEM
    imagem = Image.new("RGBA", (grande, grande), FUNDO)
    pixels = imagem.load()

    centro = grande / 2
    raio = centro * fracao_raio

    for y in range(grande):
        dy = y - centro
        for x in range(grande):
            dx = x - centro
            distancia = math.hypot(dx, dy)
            if distancia > raio:
                continue
            matiz = (math.degrees(math.atan2(dy, dx)) + 90) % 360
            r, g, b = colorsys.hsv_to_rgb(matiz / 360, min(1.0, distancia / raio), 1.0)
            pixels[x, y] = (int(r * 255), int(g * 255), int(b * 255), 255)

    return imagem.resize((lado, lado), Image.LANCZOS)


def com_cantos(imagem: Image.Image, raio_canto: int) -> Image.Image:
    """Aplica cantos arredondados, para o icone comum (nao maskable)."""
    mascara = Image.new("L", imagem.size, 0)
    ImageDraw.Draw(mascara).rounded_rectangle(
        [(0, 0), (imagem.size[0] - 1, imagem.size[1] - 1)], radius=raio_canto, fill=255
    )
    saida = Image.new("RGBA", imagem.size, (0, 0, 0, 0))
    saida.paste(imagem, (0, 0), mascara)
    return saida


def principal():
    os.makedirs(SAIDA, exist_ok=True)

    # Icone comum: roda grande, cantos arredondados.
    for lado in (192, 512):
        icone = com_cantos(desenhar_roda(lado, 0.78), int(lado * 0.22))
        caminho = os.path.join(SAIDA, "icone-{}.png".format(lado))
        icone.save(caminho)
        print("gerado: {}".format(caminho))

    # Maskable: o Android recorta ate 20% de cada borda, entao a roda
    # precisa caber dentro da zona segura e o fundo vai ate a borda.
    maskable = desenhar_roda(512, 0.56)
    caminho = os.path.join(SAIDA, "icone-maskable-512.png")
    maskable.save(caminho)
    print("gerado: {}".format(caminho))

    # Apple nao le o manifest: precisa do PNG proprio, sem transparencia.
    apple = desenhar_roda(180, 0.78).convert("RGB")
    caminho = os.path.join(SAIDA, "apple-touch-icon.png")
    apple.save(caminho)
    print("gerado: {}".format(caminho))

    # Favicon da aba.
    favicon = com_cantos(desenhar_roda(64, 0.82), 14)
    caminho = os.path.join(SAIDA, "favicon.png")
    favicon.save(caminho)
    print("gerado: {}".format(caminho))


if __name__ == "__main__":
    sys.exit(principal())
