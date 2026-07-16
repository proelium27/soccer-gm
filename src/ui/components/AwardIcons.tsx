/**
 * Small inline-SVG award glyphs (not emoji), sized to sit inline with text
 * via `1em` and colored via `currentColor` so they follow the surrounding
 * text color/theme automatically.
 */

interface IconProps {
  title: string;
  className?: string;
}

export function TrophyIcon({ title, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="currentColor"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <path d="M6 3h12v2h3v1.5c0 2.9-2.1 5.3-4.9 5.8-.7 1.5-2 2.6-3.6 3v2.2h3.3v2H8.2v-2h3.3v-2.2c-1.6-.4-2.9-1.5-3.6-3C5.1 11.8 3 9.4 3 6.5V5h3V3zm0 4H4.6c.2 1.5 1.1 2.8 2.4 3.5-.3-.9-.4-1.9-.4-2.8V7zm12 0v.7c0 .9-.1 1.9-.4 2.8 1.3-.7 2.2-2 2.4-3.5H18z" />
    </svg>
  );
}

export function BootIcon({ title, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="currentColor"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <path d="M7 3h4v6.2l4.6 3.1c1.2.8 1.9 2.1 1.9 3.6V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3.4c0-.9.4-1.8 1.1-2.4L7 9.3V3zm2 2v5.1L4.4 13.7c-.3.2-.4.5-.4.9V18h11v-2.1c0-.8-.4-1.5-1-2l-4.6-3.1V5H9z" />
    </svg>
  );
}
