"""
Fase 0, passo 2: mapa GATT.

Conecta em um dispositivo BLE e imprime a arvore completa de servicos e
caracteristicas, comparando com o catalogo de familias conhecidas.

Uso:
    .venv\\Scripts\\python.exe tools\\dump.py AC:C2:01:70:1A:5F
"""
import asyncio
import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from bleak import BleakClient  # noqa: E402
import catalogo  # noqa: E402

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


async def principal():
    if len(sys.argv) < 2:
        print("Informe o endereco. Exemplo: dump.py AC:C2:01:70:1A:5F")
        return
    endereco = sys.argv[1]

    print("Conectando em {} ...".format(endereco))
    async with BleakClient(endereco, timeout=20.0) as cliente:
        print("Conectado.")
        print("")

        arvore = []
        escritaveis = []
        for servico in cliente.services:
            print("SERVICO {}".format(servico.uuid))
            if servico.description:
                print("        {}".format(servico.description))
            item = {"uuid": servico.uuid, "descricao": servico.description,
                    "caracteristicas": []}
            for c in servico.characteristics:
                props = ",".join(c.properties)
                print("  char  {}  [{}]".format(c.uuid, props))
                item["caracteristicas"].append({
                    "uuid": c.uuid,
                    "handle": c.handle,
                    "propriedades": list(c.properties),
                    "descricao": c.description,
                })
                if "write" in c.properties or "write-without-response" in c.properties:
                    escritaveis.append((servico.uuid, c.uuid, list(c.properties)))
            arvore.append(item)
            print("")

        uuids = [s["uuid"] for s in arvore]
        familias = catalogo.familias_por_servico(uuids)

        print("=" * 70)
        if familias:
            for chave, dados in familias:
                print("FAMILIA IDENTIFICADA: {}  (chave: {})".format(dados["nome"], chave))
                print("  servico de controle : {}".format(dados["servico"]))
                print("  caracteristica      : {}".format(dados["escrita"]))
                tem = any(c[1].lower() == dados["escrita"].lower() for c in escritaveis)
                print("  caracteristica presente e escrevivel: {}".format("SIM" if tem else "NAO"))
            print("")
            print("Proximo passo: probe.py {} {}".format(endereco, familias[0][0]))
        else:
            print("Nenhuma familia do catalogo bateu pelo UUID de servico.")
            print("Caracteristicas escreviveis encontradas:")
            for s, c, p in escritaveis:
                print("  servico {} -> char {} [{}]".format(s, c, ",".join(p)))
            print("")
            print("Rode probe.py com --todas para varrer as familias por forca bruta.")

        saida = os.path.join(RAIZ, "descobertas",
                             "gatt_{}.json".format(endereco.replace(":", "")))
        os.makedirs(os.path.dirname(saida), exist_ok=True)
        with open(saida, "w", encoding="utf-8") as f:
            json.dump({"quando": datetime.now().isoformat(),
                       "endereco": endereco,
                       "servicos": arvore,
                       "familias_detectadas": [k for k, _ in familias]},
                      f, indent=2, ensure_ascii=False)
        print("")
        print("Salvo em: {}".format(saida))


if __name__ == "__main__":
    asyncio.run(principal())
