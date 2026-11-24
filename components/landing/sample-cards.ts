import type { CardPlayer } from "@/components/ui/PlayerCard";

/** Cartas de exemplo para a vitrine (no jogo, virão do servidor). */
export const SAMPLE_CARDS: CardPlayer[] = [
  {
    name: "Tião Bolha",
    position: "ZAG",
    overall: 58,
    level: 6,
    tier: "base",
    look: { skin: "#8d5a3b", hair: "#1b1038", hairStyle: "short", shirt: "#ffffff", shirtStripe: "#34c759", beard: true },
    stats: [
      { label: "ATA", value: 34 },
      { label: "DEF", value: 66 },
      { label: "FÍS", value: 70 },
    ],
  },
  {
    name: "Faísca",
    position: "PE",
    overall: 72,
    level: 14,
    tier: "destaque",
    look: { skin: "#f2c29b", hair: "#e0a526", hairStyle: "mohawk", shirt: "#3ec5ff", shirtStripe: "#ffffff" },
    stats: [
      { label: "ATA", value: 74 },
      { label: "VEL", value: 88 },
      { label: "DRI", value: 79 },
    ],
  },
  {
    name: "Dr. Canhota",
    position: "MEI",
    overall: 84,
    level: 27,
    tier: "epica",
    look: { skin: "#5b3a26", hair: "#1b1038", hairStyle: "afro", shirt: "#ff4f8b", headband: "#ffd23f" },
    stats: [
      { label: "PAS", value: 91 },
      { label: "VIS", value: 88 },
      { label: "DRI", value: 85 },
    ],
  },
  {
    name: "O Fenômeno",
    position: "ATA",
    overall: 96,
    level: 44,
    tier: "especial",
    look: { skin: "#c68b5e", hair: "#1b1038", hairStyle: "bald", shirt: "#ffd23f", shirtStripe: "#34c759" },
    stats: [
      { label: "ATA", value: 98 },
      { label: "VEL", value: 93 },
      { label: "FIN", value: 99 },
    ],
  },
  {
    name: "Paredão",
    position: "GOL",
    overall: 63,
    level: 9,
    tier: "base",
    look: { skin: "#f5d0b0", hair: "#6b3a1f", hairStyle: "long", shirt: "#ff8a1f", beard: true },
    stats: [
      { label: "REF", value: 69 },
      { label: "POS", value: 64 },
      { label: "DEF", value: 58 },
    ],
  },
];
