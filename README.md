# Controle da Fita LED

App próprio para controlar uma fita LED Bluetooth pelo celular ou pelo computador, sem nuvem, sem conta e sem assistente de casa. Tudo acontece entre o navegador e a fita, por Web Bluetooth.

## Como rodar

```bash
cd app
npm install
npm run dev      # abre em http://localhost:5173
npm test         # 32 testes
npm run checar   # typecheck
```

Funciona no Chrome e no Edge, no Windows e no Android. O Safari do iPhone não implementa Web Bluetooth.

## A fita

| | |
|---|---|
| Nome BLE | `LEDBLE-00-1A5F` |
| Família | **LEDBLE** (quadros `7E...EF`, escrita em `FFE1`) |
| Serviço | `0000ffe0-0000-1000-8000-00805f9b34fb` |
| Escrita | `0000ffe1-0000-1000-8000-00805f9b34fb`, sem resposta |
| Tipo | RGB simples, 5050, 4 pinos |

Protocolo completo, com a evidência de cada quadro, em [`descobertas/protocolo.json`](descobertas/protocolo.json).

```
ligar      7E 00 04 01 00 00 00 00 EF
desligar   7E 00 04 00 00 00 FF 00 EF
cor        7E 00 05 03 RR GG BB 00 EF
brilho     7E 00 01 PP 00 00 00 00 EF     (PP em decimal, 0 a 100)
```

## Três coisas que custaram caro

**LEDBLE não é ELK-BLEDOM.** As duas famílias usam quadros `7E...EF` e compartilham os comandos de cor e brilho **byte por byte**. Só o comando de energia difere, e a ELK escreve em `FFF3` enquanto a LEDBLE escreve em `FFE1`. Como cor e brilho funcionavam, tudo indicava que a família estava certa. O quadro de ligar mais citado na internet (`7E 00 04 F0 00 01 FF 00 EF`) é da ELK e esta fita o ignora em silêncio.

**O controlador é mudo.** Ele aceita qualquer byte sem reclamar e nunca reporta estado: seis consultas de status conhecidas foram testadas e nenhuma obteve resposta. Comando errado não dá erro, só não acontece nada. Por isso o app é otimista e guarda o estado sozinho, e por isso toda validação de protocolo aqui é visual.

**O módulo fica surdo.** Ele entra num estado em que aceita conexão e aceita escrita sem erro, mas ignora tudo. Só tirar da tomada resolve. Antes de julgar qualquer comando novo, mande um comando de cor primeiro: se a cor mudar, o módulo está vivo e o teste vale.

## Estrutura

```
tools/          ferramentas Python de descoberta (scan, dump, sniff, probe)
descobertas/    protocolo.json e mapas GATT capturados
app/
  src/protocolo/    drivers puros: recebem intenção, devolvem bytes
  src/transporte/   Web Bluetooth real e transporte falso para teste
  src/nucleo/       fila de envio, controlador, cores, persistência
  src/componentes/  roda de cor, cenas
```

A separação entre `protocolo` (o que mandar) e `transporte` (como mandar) é o que permite testar o app inteiro sem hardware. Para suportar outra fita, basta um arquivo novo em `protocolo/`.

A `FilaDeEnvio` é o componente menos óbvio e o mais importante: arrastar o dedo no seletor de cor gera centenas de eventos por segundo, e esse controlador derruba a conexão se receber tudo. Ela envia no máximo um comando a cada 60ms, sempre o valor mais recente, e garante que uma rajada de cor nunca deixe um comando de desligar morrer de fome.

## Ferramentas de descoberta

Precisam de um ambiente Python com `bleak`:

```bash
python tools/scan.py               # lista dispositivos BLE por perto
python tools/dump.py <endereco>    # mapa GATT completo
python tools/sniff.py <endereco>   # tenta identificar o protocolo por resposta
python tools/probe.py <endereco> --bruto 7E00040100000000EF
```
