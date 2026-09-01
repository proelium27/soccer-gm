import { useCallback, useState } from "react";

/**
 * Hold the sim-target hint so a Simulation card can draw it on its heading
 * line, beside the word "Simulation", rather than under the controls.
 *
 * That placement is the whole reason this exists: it lets the select, the
 * number box and the Sim button sit in one row with the sim buttons beside
 * them, instead of being pushed into a column of their own to make space for a
 * line of text underneath.
 *
 * The setter is stable and bails when nothing changed, which matters because
 * `SimTargetForm` reports through an effect: an unstable callback, or a state
 * write on every report, would loop.
 */
export function useSimHint() {
  const [hint, setHint] = useState<{ text: string; valid: boolean } | null>(null);

  const onHintChange = useCallback((text: string, valid: boolean) => {
    setHint((prev) => (prev && prev.text === text && prev.valid === valid ? prev : { text, valid }));
  }, []);

  const node = hint
    ? <span className={`small ${hint.valid ? "text-muted" : "text-danger"}`}>{hint.text}</span>
    : null;

  return { onHintChange, node };
}
