"""
Fase 0, passo 1: varredura BLE.

Lista todo dispositivo Bluetooth Low Energy ao alcance e destaca os que
parecem fita LED. Salva o resultado em descobertas/scan.json.

Uso:
    .venv\\Scripts\\python.exe tools\\scan.py [segundos]

Saida em ASCII puro de proposito: o console do Windows aqui usa cp1252.
"""
import asyncio
import json
import os
import sys
from datetime import datetime

# PYTHONSAFEPATH=1 esta ativo no ambiente: o diretorio do script nao entra
# no sys.path sozinho, entao o import local precisa disso.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from bleak import BleakScanner  # noqa: E402
import catalogo  # noqa: E402

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, "descobertas", "scan.json")


async def varrer(segundos: float):
    achados = {}

    def ao_detectar(dispositivo, adv):
        anterior = achados.get(dispositivo.address)
        # Guarda sempre o anuncio com melhor sinal e o nome mais informativo.
        if anterior and anterior["rssi"] > adv.rssi and anterior["nome"]:
            return
        achados[dispositivo.address] = {
            "endereco": dispositivo.address,
            "nome": adv.local_name or dispositivo.name or "",
            "rssi": adv.rssi,
            "servicos": list(adv.service_uuids or []),
            "fabricante": {str(k): v.hex() for k, v in (adv.manufacturer_data or {}).items()},
            "dados_servico": {k: v.hex() for k, v in (adv.service_data or {}).items()},
        }

    scanner = BleakScanner(detection_callback=ao_detectar)
    print("Varrendo por {:.0f} segundos. Deixe a fita ligada na tomada.".format(segundos))
    print("Se a fita estiver conectada ao app do celular, ela NAO vai aparecer.")
    print("")
    await scanner.start()
    await asyncio.sleep(segundos)
    await scanner.stop()
    return list(achados.values())


def imprimir(achados):
    if not achados:
        print("Nenhum dispositivo BLE encontrado.")
        return

    achados.sort(key=lambda d: d["rssi"], reverse=True)
    candidatos = []

    print("{:<4} {:<22} {:<20} {:>6}  {}".format("#", "NOME", "ENDERECO", "RSSI", "MARCA"))
    print("-" * 82)
    for i, d in enumerate(achados, 1):
        familias = catalogo.familias_por_servico(d["servicos"])
        if familias:
            marca = "FAMILIA: " + ", ".join(f[1]["nome"] for f in familias)
        elif catalogo.parece_fita(d["nome"], d["servicos"]):
            marca = "candidato pelo nome"
        else:
            marca = ""
        if marca:
            candidatos.append((i, d, marca))
        nome = d["nome"] or "(sem nome)"
        print("{:<4} {:<22} {:<20} {:>6}  {}".format(
            i, nome[:22], d["endereco"], d["rssi"], marca))

    print("")
    if candidatos:
        print("CANDIDATOS A FITA LED:")
        for i, d, marca in candidatos:
            print("  [{}] {} em {}  ({})".format(
                i, d["nome"] or "(sem nome)", d["endereco"], marca))
            if d["servicos"]:
                print("      servicos anunciados: {}".format(", ".join(d["servicos"])))
    else:
        print("Nenhum candidato obvio. Se a fita estiver ligada e desconectada")
        print("do celular, ela pode anunciar sem nome: rode dump.py em cada")
        print("endereco sem nome com sinal forte (RSSI acima de -70).")


async def principal():
    segundos = float(sys.argv[1]) if len(sys.argv) > 1 else 12.0
    achados = await varrer(segundos)
    imprimir(achados)

    os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
    with open(SAIDA, "w", encoding="utf-8") as f:
        json.dump({"quando": datetime.now().isoformat(), "dispositivos": achados},
                  f, indent=2, ensure_ascii=False)
    print("")
    print("Salvo em: {}".format(SAIDA))


if __name__ == "__main__":
    asyncio.run(principal())
