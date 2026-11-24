import { Art } from "@/components/ui/Art";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";

/**
 * Mascote assistente técnica. Arte final: public/art/mascote.webp
 * (prompt em docs/PROMPTS-IMAGENS.md). Até lá, um avatar provisório.
 */
export function MascotImage({ className = "" }: { className?: string }) {
  return (
    <Art
      name="mascote"
      width={640}
      height={800}
      className={`object-contain object-bottom ${className}`}
      fallback={
        <PlayerAvatar
          className={className}
          look={{ skin: "#8d5a3b", hair: "#2a1a10", hairStyle: "long", shirt: "#137a34", shirtStripe: "#ffd23f" }}
        />
      }
    />
  );
}
