"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { MascotTipInline, MascotTipSide } from "@/components/game/MascotTip";
import { getSession, isGoogleEnabled, routeForSession, signInWithGoogle } from "@/lib/club/api";
import { GoogleLogo } from "./GoogleLogo";
import { Icon } from "@/components/ui/Icon";

type Status = "checking" | "idle" | "redirecting" | "disabled" | "error";

export function LoginScreen({ mascot, banner }: { mascot: ReactNode; banner: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");

  // Já está logado? Vai direto para o clube (ou para a criação dele).
  useEffect(() => {
    let alive = true;
    (async () => {
      const session = await getSession();
      if (!alive) return;
      if (session) {
        router.replace(await routeForSession(session));
      } else {
        const err = new URLSearchParams(window.location.search).get("erro");
        setStatus(err ? "error" : "idle");
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  async function handleGoogle() {
    setStatus("redirecting");
    const enabled = await isGoogleEnabled();
    if (enabled === false) {
      setStatus("disabled");
      return;
    }
    const { error } = await signInWithGoogle();
    if (error) setStatus("error");
  }

  const busy = status === "checking" || status === "redirecting";

  const tip =
    status === "disabled"
      ? "Ops! O login com Google ainda está sendo ligado pela organização. Volta daqui a pouquinho!"
      : status === "error"
        ? "Hmm, a entrada não deu certo. Tenta de novo que eu seguro a porta do vestiário."
        : "Opa, técnico! Entra com sua conta Google que eu te ajudo a fundar o seu clube.";

  return (
    <div className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 items-center gap-8 pt-2 lg:grid-cols-[minmax(0,1fr)_300px] lg:pt-6">
      <div className="mx-auto w-full min-w-0 max-w-xl">
        <MascotTipInline mascot={mascot}>{tip}</MascotTipInline>

        <section className="overflow-hidden rounded-[24px] border-[3px] border-[var(--ink)] bg-[var(--paper)] text-[var(--ink)] shadow-[0_6px_0_var(--ink)]">
          <div className="relative h-32 border-b-[3px] border-[var(--ink)] sm:h-44">{banner}</div>

          <div className="px-5 pb-6 pt-6 sm:px-8 sm:pb-8">
            <span className="tag">Vestiário</span>
            <h1 className="t-display mt-3 text-3xl text-[var(--ink)] [text-shadow:0.05em_0.05em_0_var(--sun)] sm:text-4xl">
              Entre em campo
            </h1>
            <p className="mt-2 leading-relaxed opacity-75">
              Use sua conta Google para fundar seu clube e começar na Várzea. Sem senha para decorar.
            </p>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={busy}
              className="btn btn-paper btn-lg mt-6 w-full !bg-white disabled:cursor-wait disabled:opacity-70"
            >
              {busy ? (
                <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-[var(--ink)] border-t-transparent" />
              ) : (
                <GoogleLogo className="h-6 w-6" />
              )}
              {status === "checking" ? "Verificando..." : status === "redirecting" ? "Abrindo o Google..." : "Continuar com Google"}
            </button>

            {status === "disabled" && (
              <p role="alert" className="mt-4 rounded-xl border-[3px] border-[var(--ink)] bg-[var(--cream)] px-4 py-3 text-sm font-semibold">
                O login com Google ainda não foi ativado no servidor. Tente novamente mais tarde.
              </p>
            )}
            {status === "error" && (
              <p role="alert" className="mt-4 rounded-xl border-[3px] border-[var(--ink)] bg-[#ffe0e0] px-4 py-3 text-sm font-semibold">
                Não foi possível entrar. Confira sua conexão e tente de novo.
              </p>
            )}

            <ul className="mt-6 grid gap-2 text-sm font-semibold sm:grid-cols-3">
              {["Grátis para jogar", "1 clube por conta", "Progresso salvo"].map((t) => (
                <li key={t} className="flex items-center gap-2 rounded-xl bg-[var(--cream)] px-3 py-2">
                  <Icon name="check" className="h-4 w-4 shrink-0 text-[var(--grass-2)]" />
                  {t}
                </li>
              ))}
            </ul>

            <p className="mt-6 text-xs leading-relaxed opacity-60">
              Ao entrar, você aceita os <span className="underline">Termos de uso</span> e a{" "}
              <span className="underline">Política de privacidade</span>. Usamos apenas seu e-mail e nome do Google
              para identificar sua conta.
            </p>
          </div>
        </section>

        <p className="mt-5 text-center">
          <Link href="/" className="text-sm font-bold text-white/80 underline-offset-4 hover:text-white hover:underline">
            <Icon name="back" className="mr-1 inline h-4 w-4 align-[-3px]" />
            Voltar para o início
          </Link>
        </p>
      </div>

      <MascotTipSide mascot={mascot}>{tip}</MascotTipSide>
    </div>
  );
}
