import assert from "node:assert/strict";
import { test } from "node:test";
import { FACILITIES, facilityCost, facilityIncome, HOME_GAMES_PER_SEASON, homeIncome } from "@/lib/club/facilities";
import { doubleRoundRobin } from "@/lib/league/schedule";

test("estrutura: espelho do SQL (custos e renda)", () => {
  // valores conferidos com facility_income / facility_cost no banco
  assert.equal(facilityIncome(0, 1, 0), 8);
  assert.equal(facilityIncome(0, 5, 5), 60);
  assert.equal(facilityIncome(1, 5, 5), 20);
  assert.equal(facilityIncome(2, 5, 5), 50);
  assert.equal(facilityIncome(2, 3, 1), 18);
  assert.equal(facilityCost(0, 0), 400);
  assert.equal(facilityCost(2, 4), 3000);
  assert.equal(facilityCost(1, 5), null);
  assert.equal(homeIncome([0, 0, 0], 3), 0);
});

test("estrutura: investimento se paga, mas leva tempo (não quebra a economia)", () => {
  const total = FACILITIES.reduce((s, f) => s + f.costs.reduce((a, b) => a + b, 0), 0);
  const perSeasonVarzea = homeIncome([5, 5, 5], 0) * HOME_GAMES_PER_SEASON;
  const perSeasonLendas = homeIncome([5, 5, 5], 5) * HOME_GAMES_PER_SEASON;
  // tudo no máximo: ~20 mil moedas; se paga em ~6–12 temporadas (Várzea) e menos nas Lendas
  assert.ok(total > 15000 && total < 25000, `total ${total}`);
  assert.ok(total / perSeasonVarzea > 15 && total / perSeasonVarzea < 40, `Várzea: ${(total / perSeasonVarzea).toFixed(1)} temporadas`);
  assert.ok(perSeasonLendas > perSeasonVarzea * 1.4);
  // cada nível rende mais que o anterior e custa mais
  for (const f of FACILITIES) {
    for (let n = 1; n < f.costs.length; n++) assert.ok(f.costs[n] > f.costs[n - 1] && f.income[n + 1] > f.income[n]);
  }
});

test("calendário: 9 jogos em casa por temporada para cada vaga", () => {
  const rounds = doubleRoundRobin(10);
  for (let s = 0; s < 10; s++) assert.equal(rounds.filter((r) => r.some((f) => f.home === s)).length, HOME_GAMES_PER_SEASON);
});
