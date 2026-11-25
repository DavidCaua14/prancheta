/**
 * Tabela de jogos (turno e returno) gerada no aparelho — não fica no banco.
 * Método do círculo: com N vagas, N-1 rodadas no turno; o returno inverte o mando.
 */

export type Fixture = { home: number; away: number };

export function doubleRoundRobin(size: number): Fixture[][] {
  const slots = Array.from({ length: size }, (_, i) => i);
  const firstLeg: Fixture[][] = [];
  for (let r = 0; r < size - 1; r++) {
    const round: Fixture[] = [];
    for (let i = 0; i < size / 2; i++) {
      const a = slots[i];
      const b = slots[size - 1 - i];
      // alterna o mando para ninguém jogar sempre em casa
      round.push((r + i) % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
    }
    firstLeg.push(round);
    // gira todos menos o primeiro
    slots.splice(1, 0, slots.pop()!);
  }
  const secondLeg = firstLeg.map((round) => round.map((f) => ({ home: f.away, away: f.home })));
  return [...firstLeg, ...secondLeg];
}
