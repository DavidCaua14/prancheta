/**
 * Divisões das ligas (o número é o mesmo da coluna `division` no banco).
 * As regras de acesso/rebaixamento estão espelhadas em SQL: division_rules().
 */
export type LeagueDivision = {
  id: number;
  name: string;
  short: string;
  art: string;
  /** quantos sobem no fim da temporada (0 = ninguém) */
  up: number;
  /** quantos caem no fim da temporada (0 = ninguém) */
  down: number;
  /** para onde vai quem sobe */
  upTo?: string;
  /** para onde vai quem cai */
  downTo?: string;
  /** força dos times da CPU: 0 = escolha aleatória na peneira, 1 = sempre a melhor opção */
  botLevel: number;
};

export const LEAGUE_DIVISIONS: LeagueDivision[] = [
  { id: 0, name: "Liga da Várzea", short: "Várzea", art: "div-varzea", up: 4, down: 0, upTo: "Série D", botLevel: 0 },
  { id: 1, name: "Série D", short: "Série D", art: "div-serie-d", up: 0, down: 3, downTo: "Várzea", botLevel: 1 },
];

export function divisionInfo(id: number | null | undefined): LeagueDivision {
  return LEAGUE_DIVISIONS[id ?? 0] ?? LEAGUE_DIVISIONS[0];
}

/** Zona da posição (1-based) na tabela final. */
export function zoneOf(div: LeagueDivision, pos: number, size: number): "up" | "down" | null {
  if (div.up > 0 && pos <= div.up) return "up";
  if (div.down > 0 && pos > size - div.down) return "down";
  return null;
}
