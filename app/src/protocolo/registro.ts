import { ledble } from "./ledble";
import type { DriverLed } from "./tipos";

/**
 * Registro de drivers conhecidos.
 *
 * Hoje so a ELK-BLEDOM esta aqui, que e a fita do Kevin. Quando aparecer
 * outra fita, basta escrever um arquivo novo em protocolo/ e adicionar na
 * lista: nada mais no app precisa mudar.
 */
export const DRIVERS: readonly DriverLed[] = [ledble];

export const DRIVER_PADRAO = ledble;

export function driverPorId(id: string): DriverLed | undefined {
  return DRIVERS.find((d) => d.id === id);
}

/** Servicos a declarar no filtro do Web Bluetooth (optionalServices). */
export function servicosConhecidos(): string[] {
  return [...new Set(DRIVERS.map((d) => d.servico))];
}

const u16 = (curto: string) => `0000${curto}-0000-1000-8000-00805f9b34fb`;

/**
 * Servicos de sondagem.
 *
 * O Web Bluetooth so deixa o site tocar em servicos declarados antes de
 * conectar: nao existe "liste tudo o que esse aparelho tem", como o Python
 * faz. Entao declaramos aqui os servicos usados pelos controladores LED
 * baratos mais comuns, e ao conectar um aparelho novo o app reporta quais
 * desses ele encontrou.
 *
 * Se um aparelho novo nao aparecer com nenhum servico, ele usa um UUID fora
 * desta lista, e ai precisa de uma passada no tools/dump.py para descobrir
 * qual, uma unica vez.
 */
export const SERVICOS_SONDAGEM: readonly string[] = [
  u16("ffe0"), // serial transparente: LEDBLE, JDY-10, HM-10, BT05
  u16("ffe5"), // Zengge / Magic Home
  u16("ffd5"), // Triones / Happy Lighting
  u16("fff0"), // ELK-BLEDOM / ELK-BLEDOB
  u16("ff00"), // LEDnetWF
  u16("ffb0"), // alguns controladores de fita enderecavel
  u16("ae00"), // familia Ankuoo e derivados
  u16("fd00"),
  u16("ffff"),
  u16("1801"), // Generic Attribute, quase sempre presente
  "0000fff0-0000-1000-8000-00805f9b34fb",
  "00010203-0405-0607-0809-0a0b0c0d1910", // Govee e alguns clones
];
