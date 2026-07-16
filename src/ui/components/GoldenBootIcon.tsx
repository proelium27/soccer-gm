import goldenBoot from "../assets/golden-boot.png";

/** The Golden Boot award's icon — a user-supplied illustration, not a font glyph. */
export function GoldenBootIcon({ title = "Golden Boot" }: { title?: string }) {
  return <img src={goldenBoot} alt={title} title={title} className="golden-boot-icon" />;
}
