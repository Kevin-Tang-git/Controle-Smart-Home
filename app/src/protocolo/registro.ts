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
