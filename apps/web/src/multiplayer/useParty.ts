import { useEffect, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { party } from "./party";

export function useParty() {
  return useSyncExternalStore(party.subscribe, party.getSnapshot);
}

export function PartyRouteLifecycle() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (
      pathname !== "/party" &&
      pathname !== "/dungeon/online" &&
      party.getSnapshot().connection !== "idle"
    ) {
      void party.leave(false);
    }
  }, [pathname]);
  return null;
}
