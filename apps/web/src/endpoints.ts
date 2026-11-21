import { localPorts } from "@obsidian/shared";
export const apiBase =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? location.origin + "/api"
    : `http://localhost:${localPorts.api}`);
export const gameBase =
  import.meta.env.VITE_GAME_SERVER_URL ||
  (import.meta.env.PROD
    ? location.origin.replace(/^http/, "ws")
    : `ws://localhost:${localPorts.game}`);
export const apiUrl = (path: string) =>
  new URL(apiBase.replace(/\/$/, "") + "/" + path.replace(/^\//, ""));
