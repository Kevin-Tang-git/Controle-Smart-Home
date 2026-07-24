# Controle da Fita LED

App próprio para controlar uma fita LED Bluetooth pelo celular ou pelo computador, sem nuvem, sem conta e sem assistente de casa. Tudo acontece entre o navegador e a fita, por Web Bluetooth.

## Como rodar

```bash
cd app
npm install
npm run dev      # abre em http://localhost:5173
npm test         # 67 testes
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

## Vários aparelhos

A faixa no topo lista os aparelhos pareados. Tocar seleciona ou tira da seleção, e os controles agem sobre **o que estiver selecionado**: um aparelho é controle separado, vários é controle simultâneo. Não existe modo especial para nenhum dos dois casos, o que evita a interface ter dois comportamentos para a mesma ação.

Com vários selecionados, o botão de energia funciona como chave mestra (se algum está ligado, o toque desliga todos), e a roda e o brilho mostram o estado do primeiro selecionado.

**Aparelhos simulados.** O botão `+ simulado` cria um aparelho falso que aceita os comandos e reage na tela em vez de por Bluetooth. Serve para testar o controle simultâneo sem ter vários aparelhos. Funciona porque o `ControladorFita` já é otimista por necessidade: o hardware real também nunca responde, então um aparelho simulado se comporta na tela exatamente como um real.

**Protocolo desconhecido.** Ao conectar um aparelho que nenhum driver reconhece, o app não falha calado: mostra os serviços e características que encontrou, com as propriedades de cada uma. É a matéria-prima para escrever um driver novo, sem precisar do computador.

## Voz

O botão de microfone liga a escuta por voz, com uma gramática que imita a de Alexa e Google Home em português. Os comandos agem sobre **os aparelhos selecionados**, do mesmo jeito que os controles de baixo.

```
ligar a luz        / acender / ligue tudo
desligar           / apaga a luz
cor azul           / vermelho, verde, branco quente, azul escuro, roxo, ...
brilho em 50 por cento   / brilho máximo / brilho mínimo
aumenta o brilho   / diminui a luz / mais claro / mais escuro
cena 3             / ativa a cena dois
```

**Palavra de ativação.** Em branco (padrão), toda fala vira comando enquanto o microfone estiver ligado. Preenchida em `ajustes`, o app só reage depois de ouvir a palavra, como num assistente de casa: *"casa, cor azul"*. Um vocativo comum na frente (*"alexa"*, *"ok google"*, *"assistente"*) é sempre ignorado, então a frase no estilo dos assistentes funciona de qualquer jeito.

**Confirmação em voz.** Ligada por padrão, o app responde a ação em voz alta (*"Ligado"*, *"Cor azul"*, *"Brilho 50%"*) usando a síntese do navegador.

Onde mora a lógica:

```
src/nucleo/comandoVoz.ts        interpreta a transcrição em intenção (puro, testado)
src/transporte/reconhecimentoVoz.ts   Web Speech API isolada, escuta contínua
src/nucleo/useVoz.ts            cola: reconhecimento → parser → ação + confirmação
src/componentes/BotaoVoz.tsx    microfone, texto ouvido, feedback e ajustes
```

Uma ressalva honesta: o reconhecimento usa o motor do navegador, e **no Chrome o áudio é processado nos servidores do Google**. O app não grava nada e não pede conta nem chave, mas essa parte não é local como o resto. Por isso a escuta vem **desligada** e só liga quando você toca no microfone. Todo o controle da fita continua acontecendo direto entre o navegador e o Bluetooth, sem nuvem.

Aqui esbarra um limite do Web Bluetooth que vale saber: o navegador **só dá acesso a serviços declarados antes de conectar**. Não existe "liste tudo que esse aparelho expõe", como o `dump.py` faz. A lista de serviços sondados está em `SERVICOS_SONDAGEM`, em `src/protocolo/registro.ts`. Se um aparelho novo não aparecer com nenhum serviço, ele usa um UUID fora dessa lista, e descobrir qual exige uma passada pelo `tools/dump.py`, uma única vez.

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
  src/transporte/   Web Bluetooth real, reconhecimento de voz, transporte falso
  src/nucleo/       fila de envio, controlador, cores, voz, persistência
  src/componentes/  roda de cor, cenas, microfone de voz
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
