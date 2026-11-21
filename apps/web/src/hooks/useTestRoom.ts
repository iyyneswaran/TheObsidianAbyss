import type { Room } from "@colyseus/sdk";
import { TEST_ROOM } from "@obsidian/shared";
import { useEffect, useRef, useState } from "react";

type ConnectionStatus =
  | { kind: "idle" | "connecting" | "disconnecting" | "disconnected" }
  | { kind: "connected"; roomId: string; sessionId: string }
  | { kind: "error"; message: string };

interface Connection {
  close?: () => Promise<number>;
}

import { gameBase as serverUrl } from "../endpoints";

export function useTestRoom() {
  const [status, setStatus] = useState<ConnectionStatus>({ kind: "idle" });
  const current = useRef<Connection | null>(null);

  useEffect(
    () => () => {
      const connection = current.current;
      current.current = null;
      void connection?.close?.().catch(() => {});
    },
    [],
  );

  async function connect() {
    if (current.current) return;
    const connection: Connection = {};
    current.current = connection;
    setStatus({ kind: "connecting" });

    try {
      const { Client } = await import("@colyseus/sdk");
      const room: Room = await new Client(serverUrl).joinOrCreate(TEST_ROOM);
      if (current.current !== connection) {
        await room.leave();
        return;
      }

      room.reconnection.enabled = false;
      const onLeave = () => {
        if (current.current !== connection) return;
        current.current = null;
        setStatus({ kind: "disconnected" });
      };
      const onError = () => {
        if (current.current !== connection) return;
        current.current = null;
        void connection.close?.().catch(() => {});
        setStatus({
          kind: "error",
          message: "The room connection encountered an error.",
        });
      };

      room.onLeave(onLeave);
      room.onError(onError);
      connection.close = () => {
        room.onLeave.remove(onLeave);
        room.onError.remove(onError);
        return room.leave();
      };
      setStatus({
        kind: "connected",
        roomId: room.roomId,
        sessionId: room.sessionId,
      });
    } catch {
      if (current.current !== connection) return;
      current.current = null;
      setStatus({
        kind: "error",
        message:
          "Could not connect to the game server. Check that it is running and try again.",
      });
    }
  }

  async function disconnect() {
    const connection = current.current;
    if (!connection?.close) return;
    setStatus({ kind: "disconnecting" });
    const close = connection.close;
    delete connection.close;

    try {
      await close();
      if (current.current === connection) setStatus({ kind: "disconnected" });
    } catch {
      if (current.current === connection) {
        setStatus({
          kind: "error",
          message: "Could not confirm that the room disconnected.",
        });
      }
    } finally {
      if (current.current === connection) current.current = null;
    }
  }

  return { status, connect, disconnect };
}
