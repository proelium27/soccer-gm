import { useEffect, useRef, useState, type ReactNode } from "react";

interface DropdownProps {
  /** Button label / contents. */
  label: ReactNode;
  disabled?: boolean;
  /** Align the menu's right edge to the button (keeps it on-screen near the viewport edge). */
  alignEnd?: boolean;
  buttonClassName?: string;
  menuClassName?: string;
  /** Menu items (typically <li><button className="dropdown-item">…</button></li>). */
  children: ReactNode;
  /** Extra class on the wrapper (e.g. responsive show/hide utilities). */
  className?: string;
  /** Optional accessible label when the trigger has no text (icon-only). */
  ariaLabel?: string;
}

/**
 * A click-to-toggle dropdown built on React state rather than Bootstrap's JS
 * (the app ships Bootstrap CSS only — no bundle — so `data-bs-toggle` never
 * worked). Reuses Bootstrap's `.dropdown-menu` positioning/styling; visibility
 * is the `.show` class we toggle ourselves. Closes on outside click, Escape, or
 * any click inside the menu (item selection), matching PitchField's popover.
 */
export function Dropdown({
  label,
  disabled,
  alignEnd,
  buttonClassName = "btn btn-outline-light btn-sm dropdown-toggle",
  menuClassName = "",
  children,
  className = "",
  ariaLabel,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleDocClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className={`dropdown ${className}`} ref={ref}>
      <button
        className={buttonClassName}
        type="button"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      <ul
        className={`dropdown-menu ${alignEnd ? "dropdown-menu-end" : ""} ${open ? "show" : ""} ${menuClassName}`}
        onClick={() => setOpen(false)}
      >
        {children}
      </ul>
    </div>
  );
}
