"""
Fase 0, passo 3: sonda de protocolo.

Envia sequencias de comando conhecidas e cronometradas para a fita.
Quem valida e o olho humano: voce olha a fita e diz o que aconteceu.

Uso:
    python tools\\probe.py AC:C2:01:70:1A:5F --quadro triones
    python tools\\probe.py AC:C2:01:70:1A:5F --quadro elk
    python tools\\probe.py AC:C2:01:70:1A:5F --bruto 56FF0000 00F0AA

Opcoes:
    --quadro   familia de quadros a testar (triones, elk, lednetwf)
    --char     UUID de 16 bits da caracteristica de escrita (padrao: auto)
    --bruto    envia bytes hex crus, um comando por argumento
"""
import asyncio
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from bleak import BleakClient, BleakScanner  # noqa: E402
import catalogo  # noqa: E402

# Ordem de preferencia da caracteristica de escrita quando em modo auto.
PREFERENCIA_CHAR = ["ffe1", "ffd9", "fff3", "ffe9", "ff01"]

# Quadros: separados da caracteristica de proposito. Em modulo serial
# transparente a mesma char FFE1 pode carregar qualquer um destes.
def csum(quadro):
    """Checksum aditivo do protocolo flux_led / Magic Home."""
    return bytes(quadro) + bytes([sum(quadro) & 0xFF])


QUADROS = {
    "fluxled": {
        "nome": "flux_led / Magic Home (com checksum)",
        "ligar": lambda: csum([0x71, 0x23, 0x0F]),
        "desligar": lambda: csum([0x71, 0x24, 0x0F]),
        "cor": lambda r, g, b: csum([0x31, r, g, b, 0x00, 0xF0, 0x0F]),
        "branco": lambda: csum([0x31, 0x00, 0x00, 0x00, 0xFF, 0x0F, 0x0F]),
    },
    "triones": {
        "nome": "Triones / Happy Lighting",
        "ligar": lambda: bytes([0xCC, 0x23, 0x33]),
        "desligar": lambda: bytes([0xCC, 0x24, 0x33]),
        "cor": lambda r, g, b: bytes([0x56, r, g, b, 0x00, 0xF0, 0xAA]),
        "branco": lambda: bytes([0x56, 0x00, 0x00, 0x00, 0xFF, 0x0F, 0xAA]),
    },
    "elk": {
        "nome": "ELK-BLEDOM",
        "ligar": lambda: bytes([0x7E, 0x00, 0x04, 0xF0, 0x00, 0x01, 0xFF, 0x00, 0xEF]),
        "desligar": lambda: bytes([0x7E, 0x00, 0x04, 0x00, 0x00, 0x00, 0xFF, 0x00, 0xEF]),
        "cor": lambda r, g, b: bytes([0x7E, 0x00, 0x05, 0x03, r, g, b, 0x00, 0xEF]),
        "branco": lambda: bytes([0x7E, 0x00, 0x05, 0x03, 0xFF, 0xFF, 0xFF, 0x00, 0xEF]),
        # Brilho em porcentagem, 0 a 100. Ainda hipotese ate o teste visual.
        "brilho": lambda pct: bytes([0x7E, 0x00, 0x01, pct, 0x00, 0x00, 0x00, 0x00, 0xEF]),
    },
    "lednetwf": {
        "nome": "LEDnetWF",
        "ligar": lambda: bytes([0x00, 0x04, 0x80, 0x00, 0x00, 0x0D, 0x0E, 0x0B, 0x3B,
                                0x23, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                                0x00, 0x32, 0x00, 0x00, 0x90]),
        "desligar": lambda: bytes([0x00, 0x04, 0x80, 0x00, 0x00, 0x0D, 0x0E, 0x0B, 0x3B,
                                   0x24, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                                   0x00, 0x32, 0x00, 0x00, 0x91]),
        "cor": lambda r, g, b: bytes([0x00, 0x04, 0x80, 0x00, 0x00, 0x0D, 0x0E, 0x0B,
                                      0x3B, 0xA1, r, g, b, 0x00, 0x00, 0x00, 0x00,
                                      0x00, 0x00, 0x00]),
        "branco": lambda: bytes([0x00, 0x04, 0x80, 0x00, 0x00, 0x0D, 0x0E, 0x0B,
                                 0x3B, 0xA1, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00,
                                 0x00, 0x00, 0x00, 0x00]),
    },
}


def escolher_char(cliente, pedido):
    """Decide em qual caracteristica escrever."""
    disponiveis = {}
    for servico in cliente.services:
        for c in servico.characteristics:
            if "write" in c.properties or "write-without-response" in c.properties:
                disponiveis[c.uuid.lower()] = c

    if pedido:
        alvo = catalogo.uuid16(pedido) if len(pedido) == 4 else pedido.lower()
        if alvo not in disponiveis:
            raise SystemExit("Caracteristica {} nao existe ou nao aceita escrita.".format(alvo))
        return disponiveis[alvo]

    for curto in PREFERENCIA_CHAR:
        alvo = catalogo.uuid16(curto)
        if alvo in disponiveis:
            return disponiveis[alvo]

    raise SystemExit("Nenhuma caracteristica de escrita conhecida encontrada.")


async def enviar(cliente, char, dados, rotulo, espera, resposta=None):
    if resposta is None:
        resposta = "write-without-response" not in char.properties
    print("[{:>5.1f}s] {:<28} {}".format(time.monotonic() - T0, rotulo, dados.hex(" ").upper()),
          flush=True)
    try:
        await cliente.write_gatt_char(char, dados, response=resposta)
    except Exception as erro:
        print("           erro de escrita: {}".format(erro), flush=True)
    await asyncio.sleep(espera)


async def bloco(cliente, char, quadro_nome, letra, resposta=None):
    """Um bloco visual curto: liga, vermelho, verde, azul."""
    q = QUADROS[quadro_nome]
    modo = "com resposta" if resposta else "sem resposta"
    print("")
    print("--- BLOCO {} inicia em {:>5.1f}s : {} ({}) ---".format(
        letra, time.monotonic() - T0, q["nome"], modo), flush=True)
    await enviar(cliente, char, q["ligar"](), "  ligar", 2.0, resposta)
    await enviar(cliente, char, q["cor"](255, 0, 0), "  VERMELHO", 2.5, resposta)
    await enviar(cliente, char, q["cor"](0, 255, 0), "  VERDE", 2.5, resposta)
    await enviar(cliente, char, q["cor"](0, 0, 255), "  AZUL", 2.5, resposta)
    print("--- BLOCO {} termina em {:>5.1f}s, pausa morta de 4s ---".format(
        letra, time.monotonic() - T0), flush=True)
    await asyncio.sleep(4.0)


async def principal():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    endereco = sys.argv[1]
    args = sys.argv[2:]

    quadro_nome = "triones"
    char_pedida = None
    brutos = []

    i = 0
    while i < len(args):
        if args[i] == "--quadro":
            quadro_nome = args[i + 1]
            i += 2
        elif args[i] == "--char":
            char_pedida = args[i + 1]
            i += 2
        elif args[i] == "--bruto":
            brutos = args[i + 1:]
            break
        else:
            i += 1

    # No Windows, conectar direto pelo endereco falha se o dispositivo nao
    # estiver no cache de anuncios. Varrer antes e bem mais confiavel.
    # O modulo demora a voltar a anunciar depois de uma desconexao, entao
    # vale insistir algumas vezes antes de reclamar.
    alvo = None
    for tentativa in range(1, 4):
        print("Procurando {} no ar (tentativa {}/3) ...".format(endereco, tentativa),
              flush=True)
        alvo = await BleakScanner.find_device_by_address(endereco, timeout=15.0)
        if alvo is not None:
            break
        await asyncio.sleep(3.0)
    if alvo is None:
        print("")
        print("Dispositivo nao esta anunciando. Checklist:")
        print("  1. a fita esta na tomada?")
        print("  2. o app do controle esta FECHADO no celular?")
        print("     (feche de vez, nao so minimize, ou desligue o Bluetooth do celular)")
        print("  3. se os dois estao ok, tire a fita da tomada por 5 segundos")
        print("     e ligue de novo: o modulo trava depois de queda de conexao.")
        return

    print("Achado. Conectando ...", flush=True)
    # use_cached_services=False evita a "Falha catastrofica" do WinRT, que
    # acontece quando o Windows reaproveita a tabela GATT de uma sessao que
    # caiu. Forcar a redescoberta custa ~1s e resolve.
    async with BleakClient(alvo, timeout=20.0,
                           winrt={"use_cached_services": False}) as cliente:
        # Alguns modulos seriais descartam o que chega logo apos o connect.
        await asyncio.sleep(1.0)
        char = escolher_char(cliente, char_pedida)
        print("Escrevendo em {}  [{}]".format(char.uuid, ",".join(char.properties)))
        print("")

        global T0
        T0 = time.monotonic()

        if brutos:
            for hexa in brutos:
                dados = bytes.fromhex(hexa.replace(" ", ""))
                await enviar(cliente, char, dados, "bruto", 2.0)
            return

        if quadro_nome == "varredura":
            # Fita apagada e comprovadamente viva. Cor sozinha NAO acende
            # (provado no bloco D do teste anterior), entao qualquer luz que
            # aparecer e merito do candidato daquele bloco.
            # Cada candidato vai 3 vezes: o modulo perde pacote com folga.
            desligar = bytes.fromhex("7E0004000000FF00EF")
            cor = lambda r, g, b: bytes([0x7E, 0x00, 0x05, 0x03, r, g, b, 0x00, 0xEF])
            candidatos = [
                ("7E0004F00001FF00EF", (255, 0, 0), "VERMELHO", "documentado F0+01"),
                ("7E0004000001FF00EF", (0, 255, 0), "VERDE", "byte 5 sozinho"),
                ("7E0404010000000 0EF".replace(" ", ""), (0, 0, 255), "AZUL", "variante MELK"),
                ("7E0004010000FF00EF", (255, 255, 0), "AMARELO", "byte 3 = 01"),
                ("7E0004F00000FF00EF", (255, 0, 255), "MAGENTA", "F0 sem o 01"),
                ("7E0004F0000100 00EF".replace(" ", ""), (0, 255, 255), "CIANO", "F0+01 sem o FF"),
            ]

            print("VARREDURA DE COMANDOS DE LIGAR")
            for _, _, nome_cor, nota in candidatos:
                print("  {:<9} = {}".format(nome_cor, nota))
            print("")

            for hexa, (r, g, b), nome_cor, nota in candidatos:
                print("--- candidato {} ({}) ---".format(nome_cor, nota), flush=True)
                await enviar(cliente, char, desligar, "  garante apagado", 1.0)
                for tentativa in range(3):
                    await enviar(cliente, char, bytes.fromhex(hexa),
                                 "  ligar {}/3".format(tentativa + 1), 0.15)
                await enviar(cliente, char, cor(r, g, b), "  cor " + nome_cor, 2.6)

            await enviar(cliente, char, desligar, "apaga no fim", 0.2)
            print("")
            print("Quais cores apareceram?")
            return

        if quadro_nome == "cicloreal":
            # Roda com a fita comprovadamente ACESA pelo app original.
            # Assim cada passo tem resposta visual inequivoca e da para
            # saber se o modulo esta vivo antes de julgar o comando de
            # energia. Cada passo e anunciado com folga de 3s.
            ligar = bytes.fromhex("7E000400000 1FF00EF".replace(" ", ""))
            desligar = bytes.fromhex("7E0004000000FF00EF")
            cor = lambda r, g, b: bytes([0x7E, 0x00, 0x05, 0x03, r, g, b, 0x00, 0xEF])

            print("CICLO COM A FITA JA ACESA PELO APP ORIGINAL")
            print("  passo 1: cor VERDE     -> prova que o modulo esta vivo")
            print("  passo 2: DESLIGAR      -> prova que o apagar funciona")
            print("  passo 3: LIGAR         -> A PERGUNTA: volta a acender?")
            print("  passo 4: cor AZUL      -> visivel so se o passo 3 funcionou")
            print("")
            await enviar(cliente, char, cor(0, 255, 0), "1. VERDE (modulo vivo?)", 4.0)
            await enviar(cliente, char, desligar, "2. DESLIGAR", 4.0)
            await enviar(cliente, char, ligar, "3. LIGAR", 4.0)
            await enviar(cliente, char, cor(0, 0, 255), "4. AZUL", 3.0)
            print("")
            print("Relate os quatro passos: ficou verde? apagou? voltou? ficou azul?")
            return

        if quadro_nome == "tempo":
            # O quadro de ligar 7E 00 04 00 00 01 FF 00 EF acende a fita
            # quando vai isolado, mas nao acende quando o app manda cor
            # 60ms depois. Este teste isola SO o tempo: mesmo quadro de
            # ligar nos tres blocos, mudando apenas o intervalo ate o
            # proximo comando.
            ligar = bytes.fromhex("7E000400000 1FF00EF".replace(" ", ""))
            desligar = bytes.fromhex("7E0004000000FF00EF")
            cor = lambda r, g, b: bytes([0x7E, 0x00, 0x05, 0x03, r, g, b, 0x00, 0xEF])

            print("TESTE DE TEMPO APOS O COMANDO DE LIGAR")
            print("Preambulo deixa a fita lembrando BRANCO e apagada.")
            print("  Bloco 1: ligar sozinho, nada depois   -> deve dar BRANCO")
            print("  Bloco 2: ligar + cor 60ms depois      -> deve dar VERDE")
            print("  Bloco 3: ligar + cor 400ms depois     -> deve dar AZUL")
            print("")

            # Preambulo: garante que a cor lembrada e branco e a fita apaga.
            await enviar(cliente, char, ligar, "preambulo: ligar", 0.5)
            await enviar(cliente, char, cor(255, 255, 255), "preambulo: branco", 1.2)
            await enviar(cliente, char, desligar, "preambulo: apagar", 2.0)

            print("--- BLOCO 1: ligar sozinho (espera BRANCO) ---", flush=True)
            await enviar(cliente, char, ligar, "  ligar", 3.5)
            await enviar(cliente, char, desligar, "  apagar", 2.0)

            print("--- BLOCO 2: ligar + cor a 60ms (espera VERDE) ---", flush=True)
            await enviar(cliente, char, ligar, "  ligar", 0.06)
            await enviar(cliente, char, cor(0, 255, 0), "  verde", 3.5)
            await enviar(cliente, char, desligar, "  apagar", 2.0)

            print("--- BLOCO 3: ligar + cor a 400ms (espera AZUL) ---", flush=True)
            await enviar(cliente, char, ligar, "  ligar", 0.4)
            await enviar(cliente, char, cor(0, 0, 255), "  azul", 3.5)

            print("")
            print("Quais blocos acenderam? 1=branco 2=verde 3=azul")
            return

        if quadro_nome == "acender":
            # A fita apaga com 7E 00 04 00 00 00 FF 00 EF (confirmado) mas
            # nao volta com o quadro de ligar do catalogo. Aqui cada
            # candidato ganha uma cor propria: a cor que aparecer diz qual
            # deles funciona. O desligar confirmado abre cada bloco para
            # garantir que a fita comeca apagada.
            desligar = bytes.fromhex("7E0004000000FF00EF")
            candidatos = [
                ("A", "7E0004F00001FF00EF", (255, 0, 0), "VERMELHO", "catalogo publico"),
                ("B", "7E0004000001FF00EF", (0, 255, 0), "VERDE", "byte 5 como chave"),
                ("C", "7E0404010000000 0EF".replace(" ", ""), (0, 0, 255), "AZUL", "variante MELK"),
                ("D", "7E00016400000000EF", (255, 255, 0), "AMARELO", "so brilho 100"),
            ]
            print("TESTE DO COMANDO DE LIGAR. Cada candidato tem uma cor.")
            print("Anote TODA cor que aparecer, pode ser mais de uma.")
            print("")
            for letra, hexa, (r, g, b), cor, nota in candidatos:
                print("--- BLOCO {} ({}) deve acender {} ---".format(letra, nota, cor),
                      flush=True)
                await enviar(cliente, char, desligar, "  apaga antes", 1.0)
                await enviar(cliente, char, bytes.fromhex(hexa), "  candidato", 0.8)
                await enviar(cliente, char,
                             bytes([0x7E, 0x00, 0x05, 0x03, r, g, b, 0x00, 0xEF]),
                             "  cor {}".format(cor), 3.0)
            await enviar(cliente, char, desligar, "apaga no fim", 0.2)
            print("")
            print("Quais cores voce viu? A=vermelho B=verde C=azul D=amarelo")
            return

        if quadro_nome == "confirmar":
            # ELK-BLEDOM ja confirmado para ligar e cor. Falta validar
            # brilho e desligar, que ainda sao hipotese do catalogo publico.
            q = QUADROS["elk"]
            print("CONFIRMACAO DE BRILHO E DESLIGAMENTO (ELK-BLEDOM)")
            print("Esperado: branco forte, escurece em dois degraus, volta")
            print("ao forte, APAGA por 3s, e acende laranja no fim.")
            print("")
            roteiro = [
                (q["cor"](255, 255, 255), "branco de referencia", 2.0),
                (q["brilho"](100), "brilho 100%", 2.0),
                (q["brilho"](50), "brilho 50%", 2.5),
                (q["brilho"](10), "brilho 10%", 2.5),
                (q["brilho"](100), "brilho 100% de volta", 2.0),
                (q["desligar"](), "DESLIGAR", 3.0),
                (q["ligar"](), "ligar de volta", 1.5),
                (q["cor"](255, 110, 0), "laranja (marcador de fim)", 0.5),
            ]
            for dados, rotulo, espera in roteiro:
                await enviar(cliente, char, dados, rotulo, espera)
            print("")
            print("O brilho variou? A fita apagou? Terminou laranja?")
            return

        if quadro_nome == "identidade":
            # Cada familia pinta uma cor unica. A ultima que funcionar fica.
            # Basta olhar a cor final para saber qual protocolo a fita fala.
            assinaturas = [
                ("fluxled",  (255, 0, 255), "MAGENTA"),
                ("elk",      (255, 255, 0), "AMARELO"),
                ("lednetwf", (0, 255, 255), "CIANO"),
            ]
            print("TESTE DE IDENTIDADE. Cada protocolo pinta uma cor propria.")
            print("A cor em que a fita PARAR identifica o protocolo.")
            print("")
            for nome, (r, g, b), cor in assinaturas:
                q = QUADROS[nome]
                await enviar(cliente, char, q["ligar"](), "{} ligar".format(nome), 0.4)
                await enviar(cliente, char, q["cor"](r, g, b),
                             "{} -> {}".format(nome, cor), 3.0)
            print("")
            print("Em que cor a fita parou?")
            print("  MAGENTA = flux_led/Magic Home | AMARELO = ELK-BLEDOM | CIANO = LEDnetWF")
            return

        if quadro_nome == "todos":
            print("VARREDURA DE 4 BLOCOS. Cada bloco dura 9,5s e e seguido")
            print("de 4s de pausa morta. Anote em que bloco a fita reagiu.")
            await bloco(cliente, char, "fluxled", "A")
            await bloco(cliente, char, "elk", "B")
            await bloco(cliente, char, "lednetwf", "C")
            await bloco(cliente, char, "triones", "D", resposta=True)
            print("")
            print("Fim da varredura.")
            return

        q = QUADROS.get(quadro_nome)
        if not q:
            raise SystemExit("Quadro desconhecido: {}".format(quadro_nome))

        print("TESTE DO QUADRO: {}".format(q["nome"]))
        print("Olhe a fita. A sequencia esperada esta abaixo.")
        print("")

        roteiro = [
            (q["ligar"](), "1. LIGAR", 2.5),
            (q["cor"](255, 0, 0), "2. VERMELHO puro", 3.0),
            (q["cor"](0, 255, 0), "3. VERDE puro", 3.0),
            (q["cor"](0, 0, 255), "4. AZUL puro", 3.0),
            (q["cor"](255, 140, 0), "5. LARANJA", 3.0),
            (q["desligar"](), "6. DESLIGAR", 3.0),
            (q["ligar"](), "7. LIGAR de volta", 1.5),
            (q["cor"](255, 255, 255), "8. BRANCO (fim)", 1.0),
        ]
        for dados, rotulo, espera in roteiro:
            await enviar(cliente, char, dados, rotulo, espera)

        print("")
        print("Fim. O que voce viu na fita, na ordem?")


T0 = 0.0

if __name__ == "__main__":
    asyncio.run(principal())
