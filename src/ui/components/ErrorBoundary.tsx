import { Component, type ErrorInfo, type ReactNode } from "react";
import posthog from "posthog-js";

interface Props {
  children: ReactNode;
  /** Shown above the error text, e.g. "the transfers page". */
  what?: string;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

/**
 * Catches a render-time throw so one broken page doesn't blank the whole game.
 *
 * Before this existed, any exception on any page unmounted the entire React
 * tree and left a white screen with the reason only in the browser console, so
 * a crash report was never more specific than "it crashed". This keeps the nav
 * usable, shows what went wrong, and reports the exception to PostHog so the
 * stack trace reaches error tracking (see `capture_exceptions` in main.tsx).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null });
    // Keep the console trace (it's what a dev looks at first) and mirror it to
    // PostHog so crashes in the wild are visible without a bug report.
    console.error("Caught by ErrorBoundary:", error, info.componentStack);
    // Never let reporting break the boundary: a throw in here (posthog not
    // initialized because the key is unset in a local build, say) would be an
    // error inside the error handler, which React propagates — blanking the app
    // exactly like it did before this component existed.
    try {
      // Plain (non-`$`) property names: `$`-prefixed keys are PostHog-reserved
      // and would risk overwriting its own exception schema.
      posthog.captureException(error, {
        caught_by: "ErrorBoundary",
        component_stack: info.componentStack,
        boundary_what: this.props.what,
        crash_pathname: window.location.pathname + window.location.hash,
      });
    } catch {
      // Reporting is best-effort; the fallback UI still renders.
    }
  }

  private reset = () => {
    this.setState({ error: null, componentStack: null });
  };

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    const where = this.props.what ?? "this page";
    const details = [
      `${error.name}: ${error.message}`,
      error.stack ?? "",
      componentStack ? `\nComponent stack:${componentStack}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    return (
      <div className="p-3">
        <div className="alert alert-danger">
          <h5 className="alert-heading">Something broke on {where}</h5>
          <p className="mb-2">
            Sorry about that. Your save isn't affected, nothing was written to
            it, and the rest of the game still works. You can try loading this
            page again, or use the menu to go somewhere else.
          </p>
          <p className="mb-0">
            If it keeps happening, copy the details below into a bug report so
            it can be fixed.
          </p>
        </div>

        <div className="d-flex gap-2 mb-3">
          <button type="button" className="btn btn-primary btn-sm" onClick={this.reset}>
            Try again
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => window.location.reload()}
          >
            Reload the game
          </button>
        </div>

        <details>
          <summary className="text-muted small">Error details</summary>
          <pre
            className="small mt-2 p-2 bg-body-secondary rounded"
            style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}
          >
            {details}
          </pre>
        </details>
      </div>
    );
  }
}
