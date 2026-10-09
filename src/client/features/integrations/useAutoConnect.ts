import * as React from "react";
import type { GooglePickerSelection } from "@/client/features/integrations/GooglePropertyPicker";

export type AutoConnectState = {
  tried: React.MutableRefObject<boolean>;
  active: React.MutableRefObject<boolean>;
  /** Toast suffix while a suggested property is being saved. */
  suffix: () => string;
  settle: () => void;
};

export function useAutoConnectState(): AutoConnectState {
  const tried = React.useRef(false);
  const active = React.useRef(false);
  return {
    tried,
    active,
    suffix: () =>
      active.current ? ": the property matches this project's domain" : "",
    settle: () => {
      active.current = false;
    },
  };
}

/**
 * Once the Google account is authorized, connect the property that matches
 * the project's domain without a manual pick. One attempt per mount; the
 * connected state keeps "Change property" for corrections.
 */
export function useAutoConnectEffect(
  state: AutoConnectState,
  {
    options,
    showPicker,
    connected,
    picking,
    pending,
    connect,
  }: {
    options: { suggested: GooglePickerSelection | null } | undefined;
    showPicker: boolean | null | undefined;
    connected: boolean;
    picking: boolean | null | undefined;
    pending: boolean;
    connect: (selection: GooglePickerSelection) => void;
  },
) {
  const suggested = options?.suggested ?? null;
  const enabled = Boolean(showPicker) && !connected && !picking;
  const { tried, active } = state;
  React.useEffect(() => {
    if (!enabled || !suggested || pending || tried.current) return;
    tried.current = true;
    active.current = true;
    connect(suggested);
  }, [enabled, suggested, pending, connect, tried, active]);
}
