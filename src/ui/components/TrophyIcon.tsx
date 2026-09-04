/**
 * The trophy shown beside a champion — on the Standings table and on the
 * League Champion award pill.
 *
 * Hand-written inline SVG rather than an emoji, per the UI convention (see
 * SuspensionBadge/InjuryBadge for the same reasoning): an emoji renders in the
 * platform's own art style at the platform's own weight, which is the one thing
 * a design system can't reach. This draws in `currentColor`, so it inherits
 * whatever the surrounding text is set to and works on every surface.
 *
 * Decorative by default: the word "Champion" sits next to it at every call
 * site, so the icon is `aria-hidden` unless a caller passes a `title`.
 */
export function TrophyIcon({ title, size = 12 }: { title?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className="trophy-icon"
    >
      {title && <title>{title}</title>}
      {/* Bowl */}
      <path d="M4.2 2h7.6v3.4a3.8 3.8 0 0 1-7.6 0z" fill="currentColor" />
      {/* Handles */}
      <path
        d="M4.2 2.9H2.6v1.1a2.5 2.5 0 0 0 2 2.45M11.8 2.9h1.6v1.1a2.5 2.5 0 0 1-2 2.45"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {/* Stem */}
      <path d="M7.2 9.1h1.6v2.3H7.2z" fill="currentColor" />
      {/* Base */}
      <path d="M4.9 11.4h6.2c.28 0 .5.22.5.5v1.1H4.4v-1.1c0-.28.22-.5.5-.5z" fill="currentColor" />
    </svg>
  );
}
