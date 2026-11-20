import type Phaser from "phaser";
import type { DungeonMap, ExpeditionView } from "@obsidian/game-core";
import type { OnlineConnection } from "../characters/onlineActors";
export function expeditionMarkers(
  scene: Phaser.Scene,
  map: DungeonMap,
  party: OnlineConnection,
) {
  const ink = scene.add.graphics().setDepth(35);
  const labels = scene.add
    .text(0, 0, "", {
      fontFamily: "Georgia",
      fontSize: "12px",
      color: "#ffe4a6",
      backgroundColor: "#1c1529",
      padding: { x: 5, y: 3 },
    })
    .setOrigin(0.5, 1)
    .setDepth(20000);
  const markers = map.zones.filter((z) =>
    [
      "flame_vent",
      "arcane_trap",
      "zone_gate",
      "mechanism",
      "boss_gate",
      "secret_door",
      "secret_return",
    ].includes(z.kind),
  );
  let last = "",
    view: ExpeditionView | undefined;
  return () => {
    const raw = party.world?.exploration;
    if (!raw) return;
    if (raw !== last) {
      last = raw;
      view = JSON.parse(raw) as ExpeditionView;
      ink.clear();
      for (const z of markers.filter((z) => z.properties.zone === view?.zone)) {
        const x = z.x + z.width / 2,
          y = z.y + z.height / 2;
        const phase = view.traps[z.id];
        if (phase) {
          const color =
            phase === "warning"
              ? 0xffc65c
              : z.kind === "flame_vent"
                ? 0xff5933
                : 0xcf62ff;
          ink.lineStyle(
            phase === "warning" ? 3 : 1,
            color,
            phase === "recovery" ? 0.28 : 0.95,
          );
          if (phase === "active")
            ink.fillStyle(color, 0.65).fillRect(z.x, z.y, z.width, z.height);
          ink.strokeRect(z.x + 1, z.y + 1, z.width - 2, z.height - 2);
          if (phase === "warning") ink.strokeCircle(x, y, 14);
        } else if (z.kind !== "secret_door") {
          const gate = z.kind.endsWith("gate");
          const done = view.objectives.some((o) => o.id === z.id && o.done);
          const color = (gate && view.open) || done ? 0x8addbf : 0xe1ad68;
          ink.lineStyle(2, color, 0.9).strokeCircle(x, y, gate ? 19 : 13);
          if (gate)
            ink.lineStyle(4, 0xc097ed, 0.85).strokeEllipse(x, y - 10, 24, 40);
          else ink.strokeTriangle(x, y - 9, x - 7, y + 7, x + 7, y + 7);
        }
      }
    }
    const actor = party.world?.players.get(party.getSnapshot().playerId);
    const near =
      actor?.life === "ALIVE" &&
      markers.find(
        (z) =>
          z.properties.zone === view?.zone &&
          !view?.traps[z.id] &&
          Math.hypot(
            actor.x - (z.x + z.width / 2),
            actor.y - (z.y + z.height / 2),
          ) < 64,
      );
    labels.setVisible(!!near);
    if (near)
      labels
        .setPosition(near.x + near.width / 2, near.y - 8)
        .setText("G · " + String(near.properties.title));
  };
}
