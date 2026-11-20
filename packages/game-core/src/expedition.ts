import type { DungeonMap, DungeonZone } from "./dungeon.js";
import { playerFootprint, type WorldPoint } from "./movement.js";
import {
  bodyAt,
  center,
  clearSight,
  distance,
  eligible,
  immobile,
  safePoint,
  type CombatPlayer,
} from "./combat/rules.js";
import type { CombatRun } from "./combat/run.js";

export const trapRules = {
  flame_vent: {
    idle: 2200,
    warning: 1100,
    active: 570,
    recovery: 1450,
    damage: 12,
  },
  arcane_trap: {
    idle: 3100,
    warning: 1400,
    active: 480,
    recovery: 1750,
    damage: 15,
  },
};
export type TrapKind = keyof typeof trapRules;
export function trapCycle(kind: TrapKind, time: number, offset: number) {
  const { idle, warning, active, recovery } = trapRules[kind];
  const duration = idle + warning + active + recovery;
  const t = (time + offset) % duration;
  return {
    cycle: Math.floor((time + offset) / duration),
    phase:
      t < idle
        ? "idle"
        : t < idle + warning
          ? "warning"
          : t < idle + warning + active
            ? "active"
            : "recovery",
  };
}
export interface ChartRoom {
  id: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  shrine: boolean;
  secret: boolean;
  markers: { id: string; kind: string; x: number; y: number; title: string }[];
}
export interface ExpeditionView {
  zone: string;
  title: string;
  revision: number;
  rooms: ChartRoom[];
  links: [string, string][];
  objectives: { id: string; title: string; done: boolean }[];
  open: boolean;
  gate: string;
  visited: number;
  secrets: number;
  total: number;
  traps: Record<string, string>;
  current: Record<string, string>;
}
export class Expedition {
  readonly sections: DungeonZone[];
  readonly discovered = new Set<string>();
  readonly activated = new Set<string>();
  readonly secrets = new Set<string>();
  readonly pending = new Map<string, WorldPoint>();
  readonly current: Record<string, string> = {};
  readonly traps: Record<string, string> = {};
  readonly zoneObjects = new Map<string, DungeonZone[]>();
  private readonly hit = new Map<string, number>();
  private changed = true;
  private cachedChart = "";
  private lastRevision = 0;
  private lastCleared = -1;
  index = 0;
  revision = 1;
  constructor(
    private readonly run: CombatRun,
    map: DungeonMap,
  ) {
    this.sections = map.zones
      .filter((z) => z.kind === "world_zone")
      .sort((a, b) => Number(a.properties.index) - Number(b.properties.index));
    for (const section of this.sections)
      this.zoneObjects.set(
        section.id,
        map.zones.filter((z) => z.properties.zone === section.id),
      );
  }
  get zone() {
    return this.sections[this.index]!;
  }
  get objects() {
    return this.zoneObjects.get(this.zone.id)!;
  }
  private get battles() {
    return this.run.encounters.regions.filter(
      (r) =>
        r.zone.properties.zone === this.zone.id && !r.zone.properties.optional,
    );
  }
  get mechanisms() {
    return this.objects.filter((z) => z.kind === "mechanism");
  }
  get open() {
    return (
      this.battles.every((r) => r.state === "clear") &&
      this.mechanisms.every((m) => this.activated.has(m.id))
    );
  }
  step() {
    const { run } = this;
    const rooms = this.objects.filter((z) => z.kind === "room");
    for (const p of run.players.values()) {
      if (!eligible(p)) continue;
      const room = rooms.find(
        (z) =>
          p.body.x >= z.x &&
          p.body.y >= z.y &&
          p.body.x < z.x + z.width &&
          p.body.y < z.y + z.height,
      );
      if (room && (!room.properties.secret || this.secrets.has(room.id))) {
        if (this.current[p.id] !== room.id) this.changed = true;
        this.current[p.id] = room.id;
        this.discovered.add(room.id);
      } else if (this.current[p.id]) {
        delete this.current[p.id];
        this.changed = true;
      }
    }
    for (const trap of this.objects.filter((z) => z.kind in trapRules)) {
      const kind = trap.kind as TrapKind;
      const { phase, cycle } = trapCycle(
        kind,
        run.time,
        Number(trap.properties.offset),
      );
      if (this.traps[trap.id] !== phase) this.changed = true;
      this.traps[trap.id] = phase;
      if (phase !== "active") continue;
      for (const p of run.players.values()) {
        const { x, y } = p.body,
          key = trap.id + "/" + p.id;
        if (
          !eligible(p) ||
          this.hit.get(key) === cycle ||
          x + playerFootprint.width / 2 <= trap.x ||
          x - playerFootprint.width / 2 >= trap.x + trap.width ||
          y + playerFootprint.height / 2 <= trap.y ||
          y - playerFootprint.height / 2 >= trap.y + trap.height
        )
          continue;
        this.hit.set(key, cycle);
        run.damage(p, trapRules[kind].damage, trap.id);
      }
    }
  }
  interact(
    player: CombatPlayer,
    revision: number,
    credit: (member: CombatPlayer, source: string) => void,
  ) {
    const { run } = this;
    if (
      !eligible(player) ||
      immobile(player) ||
      revision !== this.revision ||
      run.ended
    )
      return false;
    const target = this.objects
      .filter((z) =>
        [
          "mechanism",
          "zone_gate",
          "secret_door",
          "secret_return",
          "boss_gate",
        ].includes(z.kind),
      )
      .find(
        (z) =>
          distance(player.body, center(z)) <= 54 &&
          clearSight(run.map, player.body, center(z)),
      );
    if (!target) return false;
    if (target.kind === "boss_gate") {
      if (!this.open || !run.encounters.enter(player)) return false;
    } else if (target.kind === "mechanism") {
      if (
        this.activated.has(target.id) ||
        !run.encounters.regions.some(
          (r) =>
            r.zone.id === target.properties.requires && r.state === "clear",
        )
      )
        return false;
      this.activated.add(target.id);
    } else if (target.kind === "zone_gate") {
      if (
        !this.open ||
        this.sections[this.index + 1]?.id !== target.properties.destination
      )
        return false;
      this.index++;
      run.shots.clear();
      run.areas.clear();
      run.monsters.clear();
      for (const id of Object.keys(this.traps)) delete this.traps[id];
      for (const member of run.players.values()) {
        if (member.life !== "ALIVE" || member.forfeited) continue;
        const entry = this.objects.find(
          (z) => z.kind === "zone_entry" && z.properties.slot === member.slot,
        )!;
        const point = center(entry);
        if (member.protected) this.pending.set(member.id, point);
        else {
          Object.assign(member.body, bodyAt(point));
          credit(member, target.id);
        }
        delete this.current[member.id];
      }
    } else {
      const dest = this.objects.find(
        (z) => z.id === target.properties.destination,
      )!;
      if (target.kind === "secret_door" && !this.secrets.has(dest.id)) {
        this.secrets.add(dest.id);
        for (const member of run.players.values())
          if (eligible(member)) credit(member, dest.id);
      }
      const point = center(dest);
      if (!safePoint(run.map, point))
        throw new Error("Unsafe secret passage exit");
      Object.assign(player.body, bodyAt(point));
    }
    this.revision++;
    return true;
  }
  reconnect(player: CombatPlayer) {
    const point = this.pending.get(player.id);
    if (point) {
      Object.assign(player.body, bodyAt(point));
      this.pending.delete(player.id);
    }
  }
  snapshot() {
    const cleared = this.run.encounters.cleared;
    if (
      this.changed ||
      this.lastRevision !== this.revision ||
      this.lastCleared !== cleared
    ) {
      this.cachedChart = JSON.stringify(this.view());
      this.lastRevision = this.revision;
      this.lastCleared = cleared;
      this.changed = false;
    }
    return this.cachedChart;
  }
  view(): ExpeditionView {
    const rooms = this.objects
      .filter((z) => z.kind === "room" && this.discovered.has(z.id))
      .map((z) => ({
        id: z.id,
        title: String(z.properties.title),
        x: z.x,
        y: z.y,
        w: z.width,
        h: z.height,
        secret: Boolean(z.properties.secret),
        markers: this.objects
          .filter(
            (m) =>
              m.properties.room === z.id &&
              [
                "mechanism",
                "boss_gate",
                "zone_gate",
                "mana_restoration_zone",
              ].includes(m.kind),
          )
          .map((m) => ({
            id: m.id,
            kind: m.kind,
            ...center(m),
            title: String(m.properties.title ?? "Mana shrine"),
          })),
        shrine: this.objects.some(
          (m) =>
            m.kind === "mana_restoration_zone" && m.properties.room === z.id,
        ),
      }));
    const links = this.objects
      .filter(
        (z) =>
          z.kind === "room_connection" &&
          this.discovered.has(String(z.properties.from)) &&
          this.discovered.has(String(z.properties.to)),
      )
      .map(
        (z) =>
          [String(z.properties.from), String(z.properties.to)] as [
            string,
            string,
          ],
      );
    return {
      zone: this.zone.id,
      title: String(this.zone.properties.title),
      revision: this.revision,
      rooms,
      links,
      objectives: [
        ...this.battles.map((r) => ({
          id: r.zone.id,
          title: "Clear " + String(r.zone.properties.title),
          done: r.state === "clear",
        })),
        ...this.mechanisms.map((z) => ({
          id: z.id,
          title: String(z.properties.title),
          done: this.activated.has(z.id),
        })),
      ],
      open: this.open,
      gate: String(
        this.objects.find(
          (z) => z.kind === "zone_gate" || z.kind === "boss_gate",
        )?.properties.title,
      ),
      visited: [...this.discovered].filter((id) => !this.secrets.has(id))
        .length,
      secrets: this.secrets.size,
      total: this.run.encounters.regions.filter(
        (r) => !r.zone.properties.optional,
      ).length,
      traps: this.traps,
      current: this.current,
    };
  }
}
