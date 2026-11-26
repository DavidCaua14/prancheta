import type { Metadata, Viewport } from "next";
import { Baloo_2, Bungee } from "next/font/google";
import { PresencePing } from "@/components/system/PresencePing";
import { UpdateWatcher } from "@/components/system/UpdateWatcher";
import "./globals.css";

const display = Bungee({
  variable: "--font-display-face",
  weight: "400",
  subsets: ["latin", "latin-ext"],
});

const body = Baloo_2({
  variable: "--font-body-face",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Prancheta — o manager de futebol online no navegador",
  description:
    "Monte seu clube, escale o time e acompanhe a partida simulada ao vivo contra outros técnicos. Manager de futebol online no navegador: cartas, ligas, copas, leilão e amistosos com amigos.",
  applicationName: "Prancheta",
};

export const viewport: Viewport = {
  themeColor: "#1d1650",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col overflow-x-hidden">
        {children}
        <UpdateWatcher />
        <PresencePing />
      </body>
    </html>
  );
}
