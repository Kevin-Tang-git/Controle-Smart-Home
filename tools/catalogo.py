"""
Catalogo de protocolos BLE conhecidos de fitas LED baratas.

Cada familia foi documentada publicamente por engenharia reversa.
Os bytes aqui sao HIPOTESES a validar com a fita na frente, nunca verdade
assumida. O probe.py testa e o resultado vira protocolo.json.

Convencao dos UUID: os controladores usam UUID de 16 bits, que o Windows
expande para o formato longo 0000XXXX-0000-1000-8000-00805f9b34fb.
"""


def uuid16(curto: str) -> str:
    """Expande um UUID de 16 bits para a forma longa usada pelo bleak."""
    return "0000{}-0000-1000-8000-00805f9b34fb".format(curto.lower())


# ---------------------------------------------------------------------------
# Geradores de comando por familia
# ---------------------------------------------------------------------------

def _elk_cor(r, g, b):
    return bytes([0x7E, 0x00, 0x05, 0x03, r, g, b, 0x00, 0xEF])


def _elk_brilho(pct):
    return bytes([0x7E, 0x00, 0x01, pct, 0x00, 0x00, 0x00, 0x00, 0xEF])


def _triones_cor(r, g, b):
    return bytes([0x56, r, g, b, 0x00, 0xF0, 0xAA])


def _triones_brilho(pct):
    # Triones nao tem comando de brilho proprio: escala o RGB no app.
    return None


def _lednetwf_cor(r, g, b):
    return bytes([0x00, 0x04, 0x80, 0x00, 0x00, 0x0D, 0x0E, 0x0B, 0x3B,
                  0xA1, r, g, b, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])


FAMILIAS = {
    "elk-bledom": {
        "nome": "ELK-BLEDOM / ELK-BLEDOB",
        "servico": uuid16("fff0"),
        "escrita": uuid16("fff3"),
        "sem_resposta": True,
        "ligar": bytes([0x7E, 0x00, 0x04, 0xF0, 0x00, 0x01, 0xFF, 0x00, 0xEF]),
        "desligar": bytes([0x7E, 0x00, 0x04, 0x00, 0x00, 0x00, 0xFF, 0x00, 0xEF]),
        "cor": _elk_cor,
        "brilho": _elk_brilho,
        "brilho_max": 100,
        "pistas_nome": ["ELK-BLEDOM", "ELK-BLEDOB", "ELK-BLE"],
    },
    "triones": {
        "nome": "Triones / Happy Lighting",
        "servico": uuid16("ffd5"),
        "escrita": uuid16("ffd9"),
        "sem_resposta": True,
        "ligar": bytes([0xCC, 0x23, 0x33]),
        "desligar": bytes([0xCC, 0x24, 0x33]),
        "cor": _triones_cor,
        "brilho": _triones_brilho,
        "brilho_max": None,
        "pistas_nome": ["Triones", "LEDBLE", "LEDBlue", "Dream"],
    },
    "zengge": {
        "nome": "Zengge / Magic Home BLE",
        "servico": uuid16("ffe5"),
        "escrita": uuid16("ffe9"),
        "sem_resposta": True,
        "ligar": bytes([0xCC, 0x23, 0x33]),
        "desligar": bytes([0xCC, 0x24, 0x33]),
        "cor": _triones_cor,
        "brilho": _triones_brilho,
        "brilho_max": None,
        "pistas_nome": ["LEDnet", "MagicLight", "Zengge", "AP-"],
    },
    "lednetwf": {
        "nome": "LEDnetWF",
        "servico": uuid16("ff00"),
        "escrita": uuid16("ff01"),
        "sem_resposta": False,
        "ligar": bytes([0x00, 0x04, 0x80, 0x00, 0x00, 0x0D, 0x0E, 0x0B, 0x3B,
                        0x23, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x32, 0x00, 0x00, 0x90]),
        "desligar": bytes([0x00, 0x04, 0x80, 0x00, 0x00, 0x0D, 0x0E, 0x0B, 0x3B,
                           0x24, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                           0x00, 0x32, 0x00, 0x00, 0x91]),
        "cor": _lednetwf_cor,
        "brilho": lambda pct: None,
        "brilho_max": None,
        "pistas_nome": ["LEDnetWF"],
    },
    "jdy-serial": {
        "nome": "JDY-10 / modulo serial transparente",
        "servico": uuid16("ffe0"),
        "escrita": uuid16("ffe1"),
        "sem_resposta": True,
        # Modulo serial: o quadro depende do firmware do controlador.
        # Testamos os dois quadros mais comuns por cima da serial.
        "ligar": bytes([0xCC, 0x23, 0x33]),
        "desligar": bytes([0xCC, 0x24, 0x33]),
        "cor": _triones_cor,
        "brilho": _triones_brilho,
        "brilho_max": None,
        "pistas_nome": ["JDY", "HMSoft", "BT05", "MLT-BT05"],
    },
}


# Nomes que costumam indicar fita LED, usados so para destacar no scan.
PISTAS_NOME_GENERICAS = [
    "LED", "LAMP", "STRIP", "ELK", "BLEDOM", "TRIONES", "LEDBLE", "QHM",
    "MELK", "SP1", "SP0", "ISP", "LEDNET", "MAGIC", "ZENGGE", "LOTUS",
    "DUOCO", "KS03", "BLE-", "RGB", "LIGHT", "IDEAL", "AP-",
]


def familias_por_servico(uuids_servico):
    """Retorna as familias cujo servico aparece na lista informada."""
    presentes = {u.lower() for u in uuids_servico}
    return [
        (chave, dados)
        for chave, dados in FAMILIAS.items()
        if dados["servico"].lower() in presentes
    ]


def parece_fita(nome, uuids_servico):
    """Heuristica: o dispositivo parece uma fita LED?"""
    if familias_por_servico(uuids_servico):
        return True
    if not nome:
        return False
    alvo = nome.upper()
    return any(pista in alvo for pista in PISTAS_NOME_GENERICAS)
