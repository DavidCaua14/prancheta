"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { MascotTipInline, MascotTipSide } from "@/components/game/MascotTip";
import { createClub, ensureValidUser, getMyClub, getSession, signOut } from "@/lib/club/api";
import {
  CREST_PATTERNS,
  CREST_SHAPES,
  CREST_SYMBOLS,
  KIT_MODELS,
  NAME_MAX,
  PALETTE,
  decodeCrest,
  decodeKit,
  encodeCrest,
  encodeKit,
  kitFromCrest,
  normalizeName,
  randomCrest,
  sanitizeTag,
  suggestTag,
  validateName,
  validateTag,
  type Crest,
  type Kit,
} from "@/lib/club/identity";
import { supabase } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/Icon";
import { CrestSvg } from "./CrestSvg";
import { KitSvg } from "./KitSvg";

const STEPS = ["Nome", "Escudo", "Camisa", "Fundar"] as const;
const DRAFT_KEY = "prancheta:draft";

type Draft = { name: string; tag: string; tagTouched: boolean; crest: string; kit: string; kitTouched: boolean };

function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Peças de interface                                                  */
/* ------------------------------------------------------------------ */

function Tabs<T extends string>({ value, options, onChange }: { value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border-[3px] border-[var(--ink)] bg-[var(--night-2)] p-1">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="tab"
          aria-selected={value === o}
          onClick={() => onChange(o)}
          className={`min-h-9 flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-extrabold transition-colors ${
            value === o ? "bg-[var(--sun)] text-[var(--ink)]" : "text-white/80 hover:bg-white/10"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function OptionGrid({ children }: { children: ReactNode }) {
  return <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">{children}</div>;
}

function Option({ selected, label, onClick, children }: { selected: boolean; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      className={`flex flex-col items-center gap-1 rounded-xl border-[3px] px-1 pb-1.5 pt-2 transition-colors ${
        selected ? "border-[var(--ink)] bg-[var(--sun)] shadow-[0_3px_0_var(--ink)]" : "border-[var(--ink)]/15 bg-white hover:border-[var(--ink)]/50"
      }`}
    >
      <span className="flex h-12 w-12 items-center justify-center">{children}</span>
      <span className="text-[0.68rem] font-extrabold uppercase leading-tight tracking-wide">{label}</span>
    </button>
  );
}

function Swatches({ label, value, onChange, disabled }: { label: string; value: number; onChange: (i: number) => void; disabled?: number[] }) {
  return (
    <fieldset className="mt-4">
      <legend className="text-xs font-extrabold uppercase tracking-[0.12em] opacity-60">{label}</legend>
      <div className="mt-2 grid grid-cols-8 gap-1.5 sm:gap-2">
        {PALETTE.map((c, i) => (
          <button
            key={c.name}
            type="button"
            title={c.name}
            aria-label={`${label}: ${c.name}`}
            aria-pressed={value === i}
            onClick={() => onChange(i)}
            disabled={disabled?.includes(i)}
            className={`aspect-square rounded-lg border-[3px] transition-transform disabled:opacity-25 ${
              value === i ? "scale-110 border-[var(--ink)] shadow-[0_0_0_3px_var(--sun)]" : "border-[var(--ink)]/40 hover:scale-105"
            }`}
            style={{ background: c.hex }}
          />
        ))}
      </div>
    </fieldset>
  );
}

function Preview({ name, tag, crest, kit }: { name: string; tag: string; crest: Crest; kit: Kit }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--night-2)] p-3 text-white md:flex-col md:gap-2 md:p-4 md:text-center">
      <CrestSvg crest={crest} tag={tag} className="h-24 w-[86px] shrink-0 md:h-36 md:w-32" title={`Escudo do ${name || "clube"}`} />
      <div className="min-w-0 flex-1 md:w-full">
        <p className="t-heading line-clamp-2 break-words text-lg leading-tight md:text-xl">{name.trim() || "Seu clube"}</p>
        <p className="mt-0.5 font-mono text-sm font-bold tracking-[0.2em] text-[var(--sun)]">{tag || "---"}</p>
      </div>
      <KitSvg kit={kit} number={10} className="h-16 w-16 shrink-0 md:mt-1 md:h-20 md:w-20" />
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function CreateClubWizard({ mascot, banner }: { mascot: ReactNode; banner: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [tagTouched, setTagTouched] = useState(false);
  const [crest, setCrest] = useState<Crest>(() => ({ shape: 0, pattern: 1, symbol: 1, c1: 7, c2: 0, c3: 5 }));
  const [kit, setKit] = useState<Kit>(() => ({ model: 1, c1: 7, c2: 0, c3: 5 }));
  const [kitTouched, setKitTouched] = useState(false);
  const [crestTab, setCrestTab] = useState<"Formato" | "Padrão" | "Símbolo" | "Cores">("Formato");
  const [kitTab, setKitTab] = useState<"Modelo" | "Cores">("Modelo");
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Precisa estar logado e ainda não ter clube.
  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await getSession();
      if (!alive) return;
      if (!s) return router.replace("/entrar");
      if (!(await ensureValidUser())) return router.replace("/entrar");
      if (!alive) return;
      try {
        const existing = await getMyClub(s);
        if (existing) return router.replace(existing.squad ? "/jogo" : "/peneira");
      } catch {
        // sem conexão: deixa montar; o envio avisa se der erro
      }
      const d = loadDraft();
      if (d) {
        setName(d.name);
        setTag(d.tag);
        setTagTouched(d.tagTouched);
        setCrest(decodeCrest(d.crest));
        setKit(decodeKit(d.kit));
        setKitTouched(d.kitTouched);
      }
      setSession(s);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  // Rascunho local: recarregar a página não perde o que foi feito.
  useEffect(() => {
    if (!ready) return;
    try {
      const d: Draft = { name, tag, tagTouched, crest: encodeCrest(crest), kit: encodeKit(kit), kitTouched };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch {}
  }, [ready, name, tag, tagTouched, crest, kit, kitTouched]);

  const effectiveKit = useMemo(() => (kitTouched ? kit : kitFromCrest(crest)), [kitTouched, kit, crest]);

  function updateName(raw: string) {
    const v = normalizeName(raw).slice(0, NAME_MAX);
    setName(v);
    setNameError(null);
    if (!tagTouched) setTag(suggestTag(v));
  }

  function updateCrest(patch: Partial<Crest>) {
    setCrest((c) => ({ ...c, ...patch }));
  }

  function updateKit(patch: Partial<Kit>) {
    setKit({ ...effectiveKit, ...patch });
    setKitTouched(true);
  }

  async function nextFromName() {
    const err = validateName(name) ?? validateTag(tag);
    if (err) return setNameError(err);
    setBusy(true);
    // 1 leitura leve para avisar já aqui se o nome está ocupado
    const { data, error } = await supabase().from("clubs").select("id").ilike("name", name.trim()).limit(1);
    setBusy(false);
    if (!error && data && data.length > 0) return setNameError("Já existe um clube com esse nome. Que tal outro?");
    setStep(1);
  }

  async function found() {
    if (!session) return;
    setBusy(true);
    setSubmitError(null);
    const res = await createClub(session, {
      name: name.trim(),
      tag,
      crest: encodeCrest(crest),
      kit: encodeKit(effectiveKit),
    });
    if ("club" in res) {
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      router.replace("/peneira");
      return;
    }
    setBusy(false);
    switch (res.error) {
      case "name_taken":
        setStep(0);
        setNameError("Esse nome acabou de ser registrado por outro técnico. Escolha outro.");
        break;
      case "already_has_club": {
        const existing = await getMyClub(session, { fresh: true });
        router.replace(existing?.squad ? "/jogo" : "/peneira");
        break;
      }
      case "session":
        await signOut();
        router.replace("/entrar");
        break;
      case "invalid":
        setStep(0);
        setNameError("Algum dado ficou inválido. Confira o nome e a sigla.");
        break;
      default:
        setSubmitError("Sem conexão com o servidor. Confira sua internet e tente de novo.");
    }
  }

  const tips = [
    "Primeiro, o nome! Ele aparece na tabela, nos jogos e no leilão — e não dá para trocar depois. A sigla vai no placar.",
    "Agora o escudo. Toque nas abas e troque formato, padrão, símbolo e cores. Sem ideia? Aperta o dado!",
    "Hora do uniforme! Já combinei a camisa com o escudo, mas pode mudar à vontade.",
    "Tudo pronto? Ao fundar o clube você aceita os Termos e a Privacidade. Te vejo na Várzea!",
  ];
  const tip = nameError && step === 0 ? `Eita! ${nameError}` : submitError ? submitError : tips[step];
  const stepLabel = `Passo ${step + 1} de ${STEPS.length}`;

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--ink)] border-t-[var(--sun)]" aria-label="Carregando" />
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-start gap-8 pt-2 lg:grid-cols-[minmax(0,1fr)_280px] lg:pt-4">
      <div className="mx-auto w-full min-w-0 max-w-3xl">
        <MascotTipInline mascot={mascot} step={stepLabel}>
          {tip}
        </MascotTipInline>

        <section className="overflow-hidden rounded-[24px] border-[3px] border-[var(--ink)] bg-[var(--paper)] text-[var(--ink)] shadow-[0_6px_0_var(--ink)]">
          {/* faixa + passos */}
          <div className="relative h-24 border-b-[3px] border-[var(--ink)] sm:h-28">
            {banner}
            <ol className="absolute inset-x-3 bottom-3 grid grid-cols-4 gap-1.5 sm:inset-x-5 sm:gap-2">
              {STEPS.map((s, i) => (
                <li
                  key={s}
                  aria-current={i === step ? "step" : undefined}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border-[3px] border-[var(--ink)] px-1 py-1 text-[0.7rem] font-extrabold uppercase sm:text-xs ${
                    i === step ? "bg-[var(--sun)]" : i < step ? "bg-[var(--grass)]" : "bg-white/85"
                  }`}
                >
                  <span className="t-num">{i < step ? <Icon name="check" className="h-3.5 w-3.5" /> : i + 1}</span>
                  <span className="hidden min-[420px]:inline">{s}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="grid grid-cols-1 gap-5 p-4 sm:p-6 md:grid-cols-[200px_minmax(0,1fr)]">
            <div className="md:sticky md:top-4 md:self-start">
              <Preview name={name} tag={tag} crest={crest} kit={effectiveKit} />
            </div>

            <div className="min-w-0">
              {step === 0 && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void nextFromName();
                  }}
                >
                  <h1 className="t-heading text-2xl">Como vai se chamar?</h1>
                  <label className="mt-4 block">
                    <span className="text-xs font-extrabold uppercase tracking-[0.12em] opacity-60">Nome do clube</span>
                    <input
                      value={name}
                      onChange={(e) => updateName(e.target.value)}
                      maxLength={NAME_MAX}
                      autoComplete="off"
                      autoFocus
                      placeholder="Ex.: Tubarões da Vila"
                      aria-invalid={Boolean(nameError)}
                      className="mt-1.5 h-12 w-full rounded-xl border-[3px] border-[var(--ink)] bg-white px-4 text-lg font-bold outline-none focus:shadow-[0_0_0_3px_var(--sky)]"
                    />
                    <span className="mt-1 block text-right text-xs font-bold opacity-50">
                      {name.trim().length}/{NAME_MAX}
                    </span>
                  </label>
                  <label className="mt-2 block">
                    <span className="text-xs font-extrabold uppercase tracking-[0.12em] opacity-60">Sigla (placar)</span>
                    <input
                      value={tag}
                      onChange={(e) => {
                        setTag(sanitizeTag(e.target.value));
                        setTagTouched(true);
                        setNameError(null);
                      }}
                      maxLength={3}
                      autoComplete="off"
                      placeholder="TUB"
                      className="mt-1.5 h-12 w-32 rounded-xl border-[3px] border-[var(--ink)] bg-white px-4 text-center font-mono text-lg font-bold uppercase tracking-[0.3em] outline-none focus:shadow-[0_0_0_3px_var(--sky)]"
                    />
                  </label>
                  {nameError && (
                    <p role="alert" className="mt-4 rounded-xl border-[3px] border-[var(--ink)] bg-[#ffe0e0] px-4 py-2.5 text-sm font-bold">
                      {nameError}
                    </p>
                  )}
                  <p className="mt-4 text-sm opacity-65">Atenção: o nome não pode ser trocado depois. Escudo e camisa podem.</p>
                  <div className="mt-6 flex justify-end">
                    <button type="submit" disabled={busy} className="btn btn-green w-full sm:w-auto">
                      {busy ? "Conferindo..." : "Próximo"}
                    </button>
                  </div>
                </form>
              )}

              {step === 1 && (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h1 className="t-heading text-2xl">Monte o escudo</h1>
                    <button type="button" onClick={() => setCrest(randomCrest())} className="btn btn-paper btn-sm" aria-label="Sortear escudo">
                      <Icon name="dice" className="h-4 w-4" />
                      Sortear
                    </button>
                  </div>
                  <div className="mt-4">
                    <Tabs value={crestTab} options={["Formato", "Padrão", "Símbolo", "Cores"] as const} onChange={setCrestTab} />
                  </div>
                  {crestTab === "Formato" && (
                    <OptionGrid>
                      {CREST_SHAPES.map((label, i) => (
                        <Option key={label} label={label} selected={crest.shape === i} onClick={() => updateCrest({ shape: i })}>
                          <CrestSvg crest={{ ...crest, shape: i }} tag={tag} className="h-12 w-11" />
                        </Option>
                      ))}
                    </OptionGrid>
                  )}
                  {crestTab === "Padrão" && (
                    <OptionGrid>
                      {CREST_PATTERNS.map((label, i) => (
                        <Option key={label} label={label} selected={crest.pattern === i} onClick={() => updateCrest({ pattern: i })}>
                          <CrestSvg crest={{ ...crest, pattern: i, symbol: 11 }} className="h-12 w-11" />
                        </Option>
                      ))}
                    </OptionGrid>
                  )}
                  {crestTab === "Símbolo" && (
                    <OptionGrid>
                      {CREST_SYMBOLS.map((label, i) => (
                        <Option key={label} label={label} selected={crest.symbol === i} onClick={() => updateCrest({ symbol: i })}>
                          <CrestSvg crest={{ ...crest, symbol: i }} tag={tag} className="h-12 w-11" />
                        </Option>
                      ))}
                    </OptionGrid>
                  )}
                  {crestTab === "Cores" && (
                    <div>
                      <Swatches label="Cor principal" value={crest.c1} onChange={(i) => updateCrest({ c1: i })} />
                      <Swatches label="Cor do padrão" value={crest.c2} onChange={(i) => updateCrest({ c2: i })} />
                      <Swatches label="Cor do símbolo" value={crest.c3} onChange={(i) => updateCrest({ c3: i })} />
                    </div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h1 className="t-heading text-2xl">Uniforme</h1>
                    {kitTouched && (
                      <button type="button" onClick={() => setKitTouched(false)} className="btn btn-paper btn-sm">
                        Igual ao escudo
                      </button>
                    )}
                  </div>
                  <div className="mt-4">
                    <Tabs value={kitTab} options={["Modelo", "Cores"] as const} onChange={setKitTab} />
                  </div>
                  {kitTab === "Modelo" && (
                    <OptionGrid>
                      {KIT_MODELS.map((label, i) => (
                        <Option key={label} label={label} selected={effectiveKit.model === i} onClick={() => updateKit({ model: i })}>
                          <KitSvg kit={{ ...effectiveKit, model: i }} className="h-12 w-12" />
                        </Option>
                      ))}
                    </OptionGrid>
                  )}
                  {kitTab === "Cores" && (
                    <div>
                      <Swatches label="Cor da camisa" value={effectiveKit.c1} onChange={(i) => updateKit({ c1: i })} />
                      <Swatches label="Cor do detalhe" value={effectiveKit.c2} onChange={(i) => updateKit({ c2: i })} />
                      <Swatches label="Gola e punhos" value={effectiveKit.c3} onChange={(i) => updateKit({ c3: i })} />
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div>
                  <h1 className="t-heading text-2xl">Tudo pronto para fundar?</h1>
                  <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    {[
                      ["Clube", name.trim()],
                      ["Sigla", tag],
                      ["Divisão inicial", "Várzea"],
                      ["Elenco", "Cartas Base"],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-xl bg-[var(--cream)] px-3 py-2">
                        <dt className="text-[0.65rem] font-extrabold uppercase tracking-[0.12em] opacity-55">{k}</dt>
                        <dd className="truncate font-extrabold">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-4 text-sm leading-relaxed opacity-70">
                    Ao fundar o clube você aceita os <span className="font-bold underline">Termos de uso</span> e a{" "}
                    <span className="font-bold underline">Política de privacidade</span>. Cada conta tem um único clube.
                  </p>
                  {submitError && (
                    <p role="alert" className="mt-4 rounded-xl border-[3px] border-[var(--ink)] bg-[#ffe0e0] px-4 py-2.5 text-sm font-bold">
                      {submitError}
                    </p>
                  )}
                </div>
              )}

              {step > 0 && (
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                  <button type="button" onClick={() => setStep(step - 1)} disabled={busy} className="btn btn-paper">
                    Voltar
                  </button>
                  {step < 3 ? (
                    <button type="button" onClick={() => setStep(step + 1)} className="btn btn-green">
                      Próximo
                    </button>
                  ) : (
                    <button type="button" onClick={found} disabled={busy} className="btn btn-green btn-lg">
                      {!busy && <Icon name="trophy" className="h-5 w-5" />}
                      {busy ? "Fundando..." : "Fundar o clube"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <p className="mt-5 text-center">
          <button
            type="button"
            onClick={async () => {
              await signOut();
              router.replace("/entrar");
            }}
            className="text-sm font-bold text-white/70 underline-offset-4 hover:text-white hover:underline"
          >
            Entrar com outra conta
          </button>
        </p>
      </div>

      <MascotTipSide mascot={mascot} step={stepLabel}>
        {tip}
      </MascotTipSide>
    </div>
  );
}
