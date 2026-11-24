import type { Metadata, Viewport } from "next";
import { Lilita_One, Nunito } from "next/font/google";
import { UpdateWatcher } from "@/components/system/UpdateWatcher";
import "./globals.css";

const display = Lilita_One({
  variable: "--font-toon-display",
  weight: "400",
  subsets: ["latin", "latin-ext"],
});

const body = Nunito({
  variable: "--font-toon-body",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Prancheta — o manager de futebol online no navegador",
  description:
    "Monte seu clube, escale o time e acompanhe a partida simulada ao vivo contra outros técnicos. O clássico manager de futebol dos anos 90, agora online, no celular e sem instalar nada.",
  applicationName: "Prancheta",
};

export const viewport: Viewport = {
  themeColor: "#231a5c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col overflow-x-hidden">
        {children}
        <UpdateWatcher />
      </body>
    </html>
  );
}
