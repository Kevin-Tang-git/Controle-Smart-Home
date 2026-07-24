"""
Fase 0, passo 3b: identificacao automatica por resposta.

A caracteristica FFE1 tem a propriedade notify. Varios controladores
respondem a um comando de consulta de status. Este script assina as
notificacoes e dispara as consultas conhecidas de cada familia, uma a uma.
Quem responder identifica o protocolo sem depender de olho humano.

Uso:
    python tools\\sniff.py AC:C2:01:70:1A:5F
"""
import asyncio
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from bleak import BleakClient  # noqa: E402

T0 = 0.0
RECEBIDO = []


def csum(quadro):
    """Checksum aditivo usado pelo protocolo flux_led / Magic Home."""
    return bytes(quadro) + bytes([sum(quadro) & 0xFF])


CONSULTAS = [
    ("triones",  bytes([0xEF, 0x01, 0x77])),
    ("fluxled",  csum([0x81, 0x8A, 0x8B])),
    ("fluxled-sem-csum", bytes([0x81, 0x8A, 0x8B])),
    ("elk-bledom", bytes([0x7E, 0x00, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0xEF])),
    ("lednetwf", bytes([0x00, 0x04, 0x80, 0x00, 0x00, 0x05, 0x06, 0x0A,
                        0x81, 0x8A, 0x8B, 0x96])),
    ("sp110e",   bytes([0x00, 0x00, 0x00, 0x10])),
]


async def principal():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    endereco = sys.argv[1]

    print("Conectando em {} ...".format(endereco), flush=True)
    async with BleakClient(endereco, timeout=20.0) as cliente:
        global T0
        T0 = time.monotonic()

        def ao_notificar(char, dados):
            marca = time.monotonic() - T0
            RECEBIDO.append((marca, char.uuid, bytes(dados)))
            print("  <<< [{:>5.1f}s] {} : {}".format(
                marca, char.uuid[4:8], bytes(dados).hex(" ").upper()), flush=True)

        # Assina toda caracteristica que suporte notify ou indicate.
        assinadas = []
        escrita = None
        for servico in cliente.services:
            for c in servico.characteristics:
                if "notify" in c.properties or "indicate" in c.properties:
                    try:
                        await cliente.start_notify(c, ao_notificar)
                        assinadas.append(c.uuid)
                    except Exception as erro:
                        print("  (nao consegui assinar {}: {})".format(c.uuid[4:8], erro))
                if c.uuid.lower().startswith("0000ffe1") and (
                        "write" in c.properties or "write-without-response" in c.properties):
                    escrita = c

        print("Assinadas: {}".format(", ".join(u[4:8] for u in assinadas) or "nenhuma"))
        if escrita is None:
            raise SystemExit("Caracteristica de escrita FFE1 nao encontrada.")
        print("Escrevendo em {}".format(escrita.uuid[4:8]))
        print("")

        sem_resposta = "write-without-response" in escrita.properties
        for nome, quadro in CONSULTAS:
            antes = len(RECEBIDO)
            print(">>> [{:>5.1f}s] consulta {:<18} {}".format(
                time.monotonic() - T0, nome, quadro.hex(" ").upper()), flush=True)
            try:
                await cliente.write_gatt_char(escrita, quadro, response=not sem_resposta)
            except Exception as erro:
                print("    erro ao escrever: {}".format(erro))
            await asyncio.sleep(2.0)
            if len(RECEBIDO) == antes:
                print("    (sem resposta)")

        print("")
        print("=" * 66)
        if RECEBIDO:
            print("RESPOSTAS RECEBIDAS: {}".format(len(RECEBIDO)))
            for marca, uuid, dados in RECEBIDO:
                print("  {:>5.1f}s  {}  {}".format(marca, uuid[4:8], dados.hex(" ").upper()))
        else:
            print("Nenhuma resposta. O controlador e mudo: so aceita comando,")
            print("nunca reporta estado. A identificacao volta a ser visual.")


if __name__ == "__main__":
    asyncio.run(principal())
