/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** PostHog project API key (public, client-side). Unset = analytics off. */
  readonly VITE_POSTHOG_KEY?: string;
  /** PostHog host. Optional; defaults to US cloud (https://us.i.posthog.com). */
  readonly VITE_POSTHOG_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
