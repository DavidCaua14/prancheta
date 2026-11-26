"use client";

import { serverNow } from "@/lib/time";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LiveMatch } from "@/components/match/LiveMatch";
import { getMyClub, getSession, type Club } from "@/lib/club/api";
import { FRIENDLY_MATCH_MS, friendlyMatch, loadFriendly, refreshFriendlyChanges, sendFriendlyChange, type FriendlyData } from "@/lib/friendly/data";
import { fmtCountdown, fmtKickoff } from "@/lib/league/core";
import { useNow } from "@/lib/league/useLeague";

/** Jogo do amistoso (?id=N): a mesma tela ao vivo da liga e das copas. */
export function FriendlyMatchView() {
  const router = useRouter();
  const now = useNow(1000);
  const [club, setClub] = useState<Club | null>(null);
  const [data, setData] = useState<FriendlyData | null | undefined>(undefined);

  useEffect(() => {
    let stop = false;
    (async () => {
      const s = await getSession();
      if (!s) return router.replace("/entrar");
      const c = await getMyClub(s);
      if (!c?.squad) return router.replace("/jogo");
      if (stop) return;
      setClub(c);
      const id = Number(new URLSearchParams(window.location.search).get("id"));
      const d = id > 0 ? await loadFriendly(id).catch(() => null) : null;
      if (!stop) setData(d);
    })();
    return () => {
      stop = true;
    };
  }, [router]);

  // ao vivo: relê as mudanças a cada 10 s (as do amigo chegam ~24 s antes de valer)
  useEffect(() => {
    if (!data?.f.guest) return;
    const id = window.setInterval(async () => {
      const t = serverNow();
      if (t < data.kickoff || t > data.kickoff + FRIENDLY_MATCH_MS) return;
      setData(await refreshFriendlyChanges(data));
    }, 10_000);
    return () => window.clearInterval(id);
  }, [data]);

  // apito e fim do jogo com a tela aberta: relê tudo (escalação do apito, últimas mudanças)
  useEffect(() => {
    if (!data) return;
    const t = serverNow();
    const moments = [data.kickoff + 2_000, data.kickoff + FRIENDLY_MATCH_MS + 2_000].filter((m) => m > t);
    if (!moments.length) return;
    const wait = Math.min(...moments) - t;
    if (wait > 86400_000) return;
    const id = window.setTimeout(async () => {
      const next = await loadFriendly(data.f.id).catch(() => null);
      if (next) setData(next);
    }, wait);
    return () => window.clearTimeout(id);
  }, [data]);

  const ready = !!data?.f.guest && !!now && (now < data.kickoff || data.loadedAt >= data.kickoff);
  const m = useMemo(() => (data && ready ? friendlyMatch(data) : null), [data, ready]);

  if (!club || data === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--ink)] border-t-[var(--sun)]" aria-label="Carregando" />
      </div>
    );
  }
  if (!data || !data.f.guest || !m) {
    const k = data?.kickoff ?? 0;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center text-white">
        <p className="font-bold">
          {!data ? "Amistoso não encontrado." : !data.f.guest ? `Ainda ninguém aceitou o convite ${data.f.code} (${fmtKickoff(k)}${now < k ? `, faltam ${fmtCountdown(k - now)}` : ""}).` : "Carregando o jogo..."}
        </p>
        <Link href="/amistosos" className="btn btn-paper btn-sm">
          Voltar para os amistosos
        </Link>
      </div>
    );
  }

  return (
    <LiveMatch
      clubId={club.id}
      m={m}
      changes={data.changes}
      title={`Amistoso · ${data.f.code}`}
      backHref="/amistosos"
      onSend={async (list) => {
        const r = await sendFriendlyChange(data, list);
        if (r.ok) setData(await refreshFriendlyChanges(data));
        return r;
      }}
    />
  );
}
