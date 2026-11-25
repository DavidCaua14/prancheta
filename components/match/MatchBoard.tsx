"use client";

import { useEffect, useRef, useState } from "react";
import { frameAt, PITCH_H, PITCH_W, type BoardFrame, type BoardPlan } from "@/lib/sim/board";

const COLORS = ["var(--sky)", "var(--hot)"] as const;

type Props = {
  /** roteiro da partida (buildPlan) — o mesmo que controla a narração */
  plan: BoardPlan;
  /** minuto "contínuo" da partida agora (ex.: 37,42); chamado a cada quadro */
  getTime: () => number;
  /** etiquetas no topo do campo (ex.: "TUV · 4-3-3 · Pra cima!") */
  labels?: [string | null, string | null];
};

/**
 * Quadro tático animado (bolinhas no campo), sincronizado com a narração.
 * As posições vêm de `frameAt` (função pura do tempo); aqui só desenhamos,
 * com uma suavização curta para nenhuma bolinha "teleportar".
 */
export function MatchBoard({ plan, getTime, labels }: Props) {
  const dotRefs = useRef<(SVGGElement | null)[]>([]);
  const ballRef = useRef<SVGGElement | null>(null);
  const passRef = useRef<SVGLineElement | null>(null);
  const shown = useRef<{ x: number; y: number }[]>([]);
  const ballShown = useRef<{ x: number; y: number } | null>(null);
  const [marks, setMarks] = useState<{ key: string; list: BoardFrame["overlays"]; flash: BoardFrame["flash"]; flipped: boolean }>({ key: "", list: [], flash: null, flipped: false });
  const getTimeRef = useRef(getTime);
  useEffect(() => {
    getTimeRef.current = getTime;
  }, [getTime]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    shown.current = [];
    ballShown.current = null;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = Math.max(0, Math.min(getTimeRef.current(), plan.length + 0.99));
      const fr = frameAt(plan, t);
      const k = 1 - Math.exp(-dt * 14);
      fr.dots.forEach((d, i) => {
        const prev = shown.current[i] ?? { x: d.x, y: d.y };
        const cur = { x: prev.x + (d.x - prev.x) * k, y: prev.y + (d.y - prev.y) * k };
        shown.current[i] = cur;
        const el = dotRefs.current[i];
        if (el) {
          el.setAttribute("transform", `translate(${cur.x.toFixed(2)} ${cur.y.toFixed(2)})`);
          el.style.opacity = d.hidden ? "0" : "1";
        }
      });
      // bola: segue o roteiro; só suaviza quando o roteiro "pula" (emenda de lances)
      const pb = ballShown.current ?? fr.ball;
      const jump = Math.hypot(fr.ball.x - pb.x, fr.ball.y - pb.y);
      const kb = jump > 5 ? 1 - Math.exp(-dt * 10) : 1;
      const b = { x: pb.x + (fr.ball.x - pb.x) * kb, y: pb.y + (fr.ball.y - pb.y) * kb };
      ballShown.current = b;
      ballRef.current?.setAttribute("transform", `translate(${b.x.toFixed(2)} ${b.y.toFixed(2)})`);
      const pl = passRef.current;
      if (pl) {
        if (fr.pass) {
          pl.setAttribute("x1", fr.pass.x1.toFixed(2));
          pl.setAttribute("y1", fr.pass.y1.toFixed(2));
          pl.setAttribute("x2", fr.pass.x2.toFixed(2));
          pl.setAttribute("y2", fr.pass.y2.toFixed(2));
          pl.style.opacity = "0.9";
        } else pl.style.opacity = "0";
      }
      // cartões, substituições e "GOL!" mudam pouco: só re-renderiza quando mudam
      const key = `${fr.flipped ? 1 : 0}|${fr.flash ?? ""}|${fr.overlays.map((o) => `${o.kind}${o.team}${Math.round(o.x)}${Math.round(o.y)}`).join(",")}`;
      setMarks((m) => (m.key === key ? m : { key, list: fr.overlays, flash: fr.flash, flipped: fr.flipped }));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [plan]);

  const dots = plan.slots.flatMap((list, team) => list.map((s, slot) => ({ team: team as 0 | 1, slot, gk: s.role === "GOL" })));

  return (
    <div className="relative overflow-hidden rounded-[20px] border-[3px] border-[var(--ink)] shadow-[0_5px_0_var(--ink)]">
      <svg viewBox={`-1.5 -1.5 ${PITCH_W + 3} ${PITCH_H + 3}`} className="pitch block w-full" role="img" aria-label="Quadro da partida">
        <g fill="none" stroke="#fff" strokeWidth="0.55" opacity="0.92">
          <rect x="0" y="0" width={PITCH_W} height={PITCH_H} rx="1" />
          <line x1={PITCH_W / 2} y1="0" x2={PITCH_W / 2} y2={PITCH_H} />
          <circle cx={PITCH_W / 2} cy={PITCH_H / 2} r="8" />
          <rect x="0" y="15" width="15" height="34" />
          <rect x={PITCH_W - 15} y="15" width="15" height="34" />
          <rect x="0" y="24" width="5" height="16" />
          <rect x={PITCH_W - 5} y="24" width="5" height="16" />
          <circle cx="11" cy={PITCH_H / 2} r="0.4" fill="#fff" />
          <circle cx={PITCH_W - 11} cy={PITCH_H / 2} r="0.4" fill="#fff" />
        </g>
        {/* gols */}
        <rect x="-1.5" y={PITCH_H / 2 - 3.6} width="1.5" height="7.2" fill="#fff" stroke="var(--ink)" strokeWidth="0.35" />
        <rect x={PITCH_W} y={PITCH_H / 2 - 3.6} width="1.5" height="7.2" fill="#fff" stroke="var(--ink)" strokeWidth="0.35" />
        <line ref={passRef} stroke="var(--sun)" strokeWidth="0.6" strokeDasharray="1.2 1.1" strokeLinecap="round" style={{ opacity: 0 }} />
        {dots.map((d, i) => (
          <g key={`${d.team}-${d.slot}`} ref={(el) => void (dotRefs.current[i] = el)} style={{ transition: "opacity .4s" }}>
            <ellipse cx="0.4" cy="2.2" rx="2" ry="0.75" fill="rgba(0,0,0,0.25)" />
            <circle r="1.95" fill={d.gk ? "var(--sun)" : COLORS[d.team]} stroke="var(--ink)" strokeWidth="0.55" />
            <circle cx="-0.6" cy="-0.45" r="0.36" fill="var(--ink)" />
            <circle cx="0.6" cy="-0.45" r="0.36" fill="var(--ink)" />
          </g>
        ))}
        <g ref={ballRef}>
          <circle r="1.15" fill="#fff" stroke="var(--ink)" strokeWidth="0.45" />
          <circle r="0.38" fill="var(--ink)" />
        </g>
        {marks.list.map((o, i) =>
          o.kind === "yellow" || o.kind === "red" ? (
            <rect key={i} x={o.x + 1.2} y={o.y - 5} width="1.8" height="2.5" rx="0.3" fill={o.kind === "yellow" ? "var(--sun)" : "var(--red)"} stroke="var(--ink)" strokeWidth="0.3" />
          ) : o.kind === "sub" ? (
            <g key={i} transform={`translate(${o.x} ${o.y - 4.6})`}>
              <circle r="1.6" fill="#fff" stroke="var(--ink)" strokeWidth="0.3" />
              <path d="M-0.8 0.2 L0 -0.8 L0.8 0.2 M0 -0.8 V0.9" stroke="var(--grass-2)" strokeWidth="0.45" fill="none" strokeLinecap="round" />
            </g>
          ) : o.kind === "injury" ? (
            <g key={i} transform={`translate(${o.x} ${o.y - 4.6})`}>
              <circle r="1.6" fill="#fff" stroke="var(--ink)" strokeWidth="0.3" />
              <path d="M-0.8 0 H0.8 M0 -0.8 V0.8" stroke="var(--red)" strokeWidth="0.55" />
            </g>
          ) : null,
        )}
      </svg>
      {labels && (
        <div className="pointer-events-none absolute inset-x-2 top-2 flex justify-between gap-2 text-[0.6rem] font-extrabold sm:text-xs">
          {(marks.flipped ? [labels[1], labels[0]] : labels).map((l, j) => {
            const i = marks.flipped ? 1 - j : j;
            return l ? (
              <span key={i} className="max-w-[48%] truncate rounded-md border-2 border-[var(--ink)] bg-white px-1.5 py-0.5 text-[var(--ink)]">
                <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: COLORS[i] }} />
                {l}
              </span>
            ) : (
              <span key={i} />
            );
          })}
        </div>
      )}
      {marks.flash === "goal" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="t-display anim-pop rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--sun)] px-4 py-1 text-3xl text-[var(--ink)] shadow-[0_4px_0_var(--ink)] sm:text-5xl">GOL!</span>
        </div>
      )}
    </div>
  );
}
