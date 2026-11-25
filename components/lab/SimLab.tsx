"use client";

/**
 * Laboratório interno de simulação (/lab) — sem banco, sem login.
 * Roda uma partida inteira entre times da CPU com o MESMO motor, roteiro e
 * quadro do jogo, no ritmo do online ou do treino, para gravar vídeo e
 * analisar o que precisa melhorar.
 *
 * Parâmetros (URL):
 *   modo=online|treino   ritmo (online = 6 s/min; treino = 1x do amistoso)
 *   jogo=N               qual partida (muda times e sorteio)
 *   div=0..5             divisão dos times da CPU
 *   de=M                 minuto em que começa
 *   vel=X                acelera o relógio (para gravações longas)
 *   debug=1              mostra o painel de depuração
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Feed, Scoreboard, StatsPanel, liveStats, tickClock } from "@/components/match/parts";
import { MatchBoard } from "@/components/match/MatchBoard";
import { hash32 } from "@/lib/cards/generate";
import { botTeam } from "@/lib/league/bots";
import { buildPlan, frameAt, scoreAtTime, visibleEvents } from "@/lib/sim/board";
import { simulate } from "@/lib/sim/engine";
import { ONLINE_MS_PER_MINUTE, TRAINING_SPEEDS } from "@/lib/sim/pace";
import { FORMATIONS } from "@/lib/tactics/formations";
import { POSTURES } from "@/lib/tactics/lineup";

type Opts = { mode: "online" | "treino"; game: number; div: number; from: number; vel: number; debug: boolean };

function readOpts(): Opts {
  const p = new URLSearchParams(window.location.search);
  return {
    mode: p.get("modo") === "treino" ? "treino" : "online",
    game: Number(p.get("jogo") ?? 1) || 1,
    div: Math.min(5, Math.max(0, Number(p.get("div") ?? 1) || 0)),
    from: Math.max(0, Number(p.get("de") ?? 0) || 0),
    vel: Math.max(0.25, Number(p.get("vel") ?? 1) || 1),
    debug: p.get("debug") === "1",
  };
}

export function SimLab() {
  const [opts, setOpts] = useState<Opts | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lê a configuração da URL uma vez
    setOpts(readOpts());
  }, []);
  if (!opts) return null;
  return <Lab key={JSON.stringify(opts)} opts={opts} />;
}

function Lab({ opts }: { opts: Opts }) {
  const msPerMinute = (opts.mode === "online" ? ONLINE_MS_PER_MINUTE : TRAINING_SPEEDS[0].ms) / opts.vel;
  const setup = useMemo(() => {
    const home = botTeam(100 + opts.game, opts.game % 10, opts.div);
    const away = botTeam(900 + opts.game, (opts.game + 3) % 10, opts.div);
    const seed = hash32(`lab:${opts.mode}:${opts.game}`);
    const result = simulate({
      seed,
      neutral: opts.mode === "treino",
      home: { name: home.name, short: home.tag, squad: home.squad, lineup: home.lineup, ai: true },
      away: { name: away.name, short: away.tag, squad: away.squad, lineup: away.lineup, ai: true },
    });
    const plan = buildPlan(result, { lineup: home.lineup, squad: home.squad }, { lineup: away.lineup, squad: away.squad }, seed);
    return { home, away, result, plan };
  }, [opts]);

  const [t0] = useState(() => performance.now());
  const getTime = useCallback(() => Math.min(setup.result.length + 0.99, opts.from + (performance.now() - t0) / msPerMinute), [opts.from, t0, msPerMinute, setup.result.length]);
  const [now, setNow] = useState(opts.from);
  useEffect(() => {
    const id = window.setInterval(() => setNow(getTime()), 100);
    return () => window.clearInterval(id);
  }, [getTime]);

  const { home, away, result, plan } = setup;
  const visible = visibleEvents(plan, result.events, now);
  const score = scoreAtTime(plan, result.events, now);
  const stats = liveStats(visible);
  const k = Math.floor(now);
  const segs = plan.minutes[Math.min(k, plan.minutes.length - 1)];
  const fm = now - k;
  const seg = segs.find((s) => fm < s.to) ?? segs[segs.length - 1];
  const fr = frameAt(plan, now);

  return (
    <div className="flex min-h-dvh flex-col" data-lab-ready="1">
      <Scoreboard
        home={{ name: home.name, tag: home.tag, crest: home.crest }}
        away={{ name: away.name, tag: away.tag, crest: away.crest }}
        score={score}
        status={now >= result.length ? "FIM" : tickClock(now, result.secondHalfTick, result.length)}
        progress={now / result.length}
      />
      <div className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 gap-4 px-3 pb-10 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-w-0 flex-col gap-4">
          <p className="text-center text-xs font-extrabold uppercase tracking-[0.15em] text-white/70">
            Laboratório · {opts.mode === "online" ? "online (6 s por minuto)" : "treino (1x)"} · jogo {opts.game}
            {opts.vel !== 1 ? ` · ${opts.vel}× mais rápido` : ""}
          </p>
          <MatchBoard
            plan={plan}
            getTime={getTime}
            labels={[
              `${home.tag} · ${FORMATIONS[home.lineup.formation].name} · ${POSTURES[home.lineup.posture].label}`,
              `${away.tag} · ${FORMATIONS[away.lineup.formation].name} · ${POSTURES[away.lineup.posture].label}`,
            ]}
          />
          {opts.debug && (
            <pre data-lab-debug className="overflow-x-auto rounded-xl bg-black/60 p-2 text-[0.7rem] leading-tight text-[var(--sun)]">
              {`t=${now.toFixed(2)} min ${k} trecho ${segs.indexOf(seg) + 1}/${segs.length} ${seg.kind}${seg.attack ? `:${seg.attack.outcome}` : ""} time=${seg.team} posse ${seg.p0.toFixed(0)}→${seg.p1.toFixed(0)}
passes ${seg.passes.map((p) => `${p.at.toFixed(2)}→${p.to}`).join(" ")}  bola ${fr.ball.x.toFixed(1)},${fr.ball.y.toFixed(1)}${fr.flipped ? " (2º tempo)" : ""}`}
            </pre>
          )}
          <Feed events={[...visible].reverse()} tags={[home.tag, away.tag]} />
        </section>
        <aside className="flex flex-col gap-4">
          <StatsPanel
            rows={[
              ["Finalizações", stats[0].shots, stats[1].shots],
              ["No gol", stats[0].onTarget, stats[1].onTarget],
              ["Escanteios", stats[0].corners, stats[1].corners],
              ["Amarelos", stats[0].yellows, stats[1].yellows],
            ]}
          />
        </aside>
      </div>
    </div>
  );
}
