export const API_SERVICE = "obsidian-abyss-api";
export const TEST_ROOM = "test_room";

export const localPorts = { web: 5173, api: 3001, game: 2567 } as const;

export interface HealthResponse {
  status: "ok";
  service: typeof API_SERVICE;
}
