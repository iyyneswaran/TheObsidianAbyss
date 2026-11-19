import { Room } from "@colyseus/core";

export class TestRoom extends Room {
  override maxClients = 4;
}
