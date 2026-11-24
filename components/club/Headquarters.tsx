"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { MascotTipInline, MascotTipSide } from "@/components/game/MascotTip";
import { getMyClub, getSession, signOut, type Club } from "@/lib/club/api";
import { decodeCrest, decodeKit } from "@/lib/club/identity";
import { CrestSvg } from "./CrestSvg";
import { KitSvg } from "./KitSvg";

const SOON = [
  { title: "Elenco", text: "Suas primeiras cartas Base." },
  { title: "Escalação", text: "Monte os 11 na prancheta." },
  { title: "Liga da Várzea", text: "Tabela e próxima rodada." },
  { title: "Leilão", text: "Cartas raras em disputa." },
];

/** Sede do clube: primeira tela depois de fundar (o jogo cresce a partir daqui). */
export function Headquarters({ mascot }: { mascot: ReactNode }) {
  const router = useRouter();
  const [club, setClub] = useState<Club | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const session = await getSession();
      if (!alive) return;
      if (!session) return router.replace("/entrar");
      try {
        const c = await getMyClub(session);
        if (!alive) return;
        if (!c) return router.replace("/clube/novo");
        setIsNew(new URLSearchParams(window.location.search).has("novo"));
        setClub(c);
      } catch {
        router.replace("/entrar?erro=1");
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  if (!club) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--ink)] border-t-[var(--sun)]" aria-label="Carregando" />
      </div>
    );
  }

  const crest = decodeCrest(club.crest);
  const kit = decodeKit(club.kit);
  const tip = isNew
    ? `Clube fundado! O ${club.name} já está inscrito na Várzea. Logo, logo a gente monta o elenco juntos.`
    : `Bem-vindo de volta, técnico do ${club.name}! As próximas novidades chegam por aqui.`;

  return (
    <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-start gap-8 pt-2 lg:grid-cols-[minmax(0,1fr)_280px] lg:pt-4">
      <div className="mx-auto w-full min-w-0 max-w-3xl">
        <MascotTipInline mascot={mascot}>{tip}</MascotTipInline>

        <section className="panel overflow-hidden">
          <div className="flex flex-col items-center gap-5 bg-[var(--night-2)] px-5 py-8 text-center text-white sm:flex-row sm:text-left">
            <CrestSvg crest={crest} tag={club.tag} className="h-32 w-28 shrink-0" title={`Escudo do ${club.name}`} />
            <div className="min-w-0 flex-1">
              <span className="tag">{isNew ? "Clube fundado!" : "Sede do clube"}</span>
              <h1 className="t-display mt-3 break-words text-3xl sm:text-4xl">{club.name}</h1>
              <p className="mt-1 font-mono font-bold tracking-[0.25em] text-[var(--sun)]">{club.tag} · Várzea</p>
            </div>
            <KitSvg kit={kit} number={10} className="h-24 w-24 shrink-0" />
          </div>

          <div className="p-5 sm:p-6">
            <h2 className="t-heading text-xl">Chegando em breve</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {SOON.map((s) => (
                <li key={s.title} className="rounded-xl border-[3px] border-dashed border-[var(--ink)]/25 bg-[var(--cream)] px-4 py-3">
                  <p className="font-extrabold">{s.title}</p>
                  <p className="text-sm opacity-70">{s.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <p className="mt-5 text-center">
          <button
            type="button"
            onClick={async () => {
              await signOut();
              router.replace("/");
            }}
            className="text-sm font-bold text-white/70 underline-offset-4 hover:text-white hover:underline"
          >
            Sair da conta
          </button>
        </p>
      </div>

      <MascotTipSide mascot={mascot}>{tip}</MascotTipSide>
    </div>
  );
}
