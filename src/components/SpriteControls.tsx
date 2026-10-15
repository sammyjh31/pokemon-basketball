import { createContext } from "react";
export type SpriteStyle = "pixel" | "artwork";
export const SpriteContext = createContext<SpriteStyle>("pixel");
export function SpriteControls({
  value,
  onChange,
}: {
  value: SpriteStyle;
  onChange: (style: SpriteStyle) => void;
}) {
  return (
    <div className="sprite-controls">
      <span>Sprites</span>
      <div role="group" aria-label="Sprite style">
        <button
          aria-pressed={value === "pixel"}
          onClick={() => onChange("pixel")}
        >
          Pixel
        </button>
        <button
          aria-pressed={value === "artwork"}
          onClick={() => onChange("artwork")}
        >
          Artwork
        </button>
      </div>
    </div>
  );
}
