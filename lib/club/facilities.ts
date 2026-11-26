/**
 * Estrutura do clube: estádio, lanchonete e loja oficial (nível 0 a 5).
 * Rendem moedas a cada jogo da liga como MANDANTE (copa e amistoso não).
 * No nível 0 não rendem nada: é preciso investir antes.
 *
 * Espelho de facility_cost / facility_income (0027_club_facilities.sql) —
 * o servidor confere e paga; aqui é só para mostrar.
 */
export type FacilityKind = 0 | 1 | 2;

export type FacilityInfo = {
  kind: FacilityKind;
  id: "estadio" | "lanchonete" | "loja";
  name: string;
  /** nome de cada nível (0 = nada construído) */
  levels: readonly string[];
  /** o que ela faz, em uma frase */
  pitch: string;
  /** custo para ir do nível n-1 ao n (índice 0 = nível 1) */
  costs: readonly number[];
  /** renda por jogo em casa na Várzea, por nível */
  income: readonly number[];
  /** quanto a renda cresce por divisão (0,1 = +10% por divisão) */
  divisionBoost: number;
  art: string;
};

export const MAX_FACILITY_LEVEL = 5;

export const FACILITIES: readonly FacilityInfo[] = [
  {
    kind: 0,
    id: "estadio",
    name: "Estádio",
    levels: ["Terrão", "Alambrado", "Arquibancada", "Estádio coberto", "Arena", "Arena lotada"],
    pitch: "Bilheteria. Quanto mais alta a divisão, mais gente na arquibancada.",
    costs: [400, 900, 1500, 2300, 3300],
    income: [0, 8, 16, 24, 32, 40],
    divisionBoost: 0.1,
    art: "facility-estadio",
  },
  {
    kind: 1,
    id: "lanchonete",
    name: "Lanchonete",
    levels: ["Nada", "Isopor", "Barraquinha", "Quiosque", "Lanchonete", "Praça de alimentação"],
    pitch: "Pastel e refri no intervalo. Renda fixa, investimento mais barato.",
    costs: [200, 450, 750, 1100, 1600],
    income: [0, 4, 8, 12, 16, 20],
    divisionBoost: 0,
    art: "facility-lanchonete",
  },
  {
    kind: 2,
    id: "loja",
    name: "Loja oficial",
    levels: ["Nada", "Banca de camisas", "Lojinha", "Loja oficial", "Megastore", "Megastore + site"],
    pitch: "Camisas e souvenirs. É a que mais cresce com a fama do clube (divisão).",
    costs: [350, 750, 1300, 2000, 3000],
    income: [0, 5, 10, 15, 20, 25],
    divisionBoost: 0.2,
    art: "facility-loja",
  },
];

/** Renda por jogo em casa (espelho de facility_income). */
export function facilityIncome(kind: FacilityKind, level: number, division: number) {
  const f = FACILITIES[kind];
  const base = f.income[Math.max(0, Math.min(MAX_FACILITY_LEVEL, level))];
  return Math.round(base * (1 + f.divisionBoost * Math.min(Math.max(division, 0), 5)));
}

/** Custo para subir do nível atual para o próximo (null = já no máximo). */
export function facilityCost(kind: FacilityKind, level: number): number | null {
  return level >= MAX_FACILITY_LEVEL ? null : FACILITIES[kind].costs[level];
}

export function homeIncome(levels: readonly number[], division: number) {
  return FACILITIES.reduce((s, f) => s + facilityIncome(f.kind, levels[f.kind] ?? 0, division), 0);
}

/** Jogos da liga em casa por temporada (10 clubes, turno e returno). */
export const HOME_GAMES_PER_SEASON = 9;
