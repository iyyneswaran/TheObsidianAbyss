import { abilitySlots, CombatRun, type CombatEvent } from "@obsidian/game-core";
import {
  MonsterState,
  SpellState,
  type CoopState,
} from "@obsidian/shared/coop";

function syncMap<T, U>(
  state:
    | Map<string, T>
    | {
        set(key: string, value: T): unknown;
        delete(key: string): unknown;
        keys(): IterableIterator<string>;
        get(key: string): T | undefined;
      },
  entities: ReadonlyMap<string, U>,
  create: () => T,
  update: (snapshot: T, entity: U) => void,
) {
  for (const id of state.keys()) if (!entities.has(id)) state.delete(id);
  for (const [id, entity] of entities) {
    const snapshot = state.get(id) ?? create();
    update(snapshot, entity);
    if (!state.get(id)) state.set(id, snapshot);
  }
}

/** Copy engine-owned values into the room's incremental Colyseus schema. */
export function publishCombat(
  state: CoopState,
  run: CombatRun,
  publish: (event: CombatEvent) => void,
) {
  for (const [id, player] of run.players) {
    const entry = state.players.get(id);
    if (!entry) continue;
    entry.hp = player.hp;
    entry.maxHp = player.maxHp;
    entry.mp = Math.floor(player.mp);
    entry.maxMp = player.maxMp;
    entry.life = player.life;
    entry.statuses = [...player.statuses.keys()].join(", ");
    entry.castAck = player.sequence;
    entry.skill3 = player.equipment.skill3 ?? "";
    entry.ultimate = player.equipment.ultimate ?? "";
    for (const slot of abilitySlots)
      entry.cooldowns.set(slot, Math.ceil(player.cooldowns[slot] / 100));
  }
  if (run.expedition) state.exploration = run.expedition.snapshot();
  const snapshot = state.combat;
  snapshot.encounter = run.encounters.current;
  snapshot.cleared = run.encounters.cleared;
  snapshot.gateOpen = run.encounters.gateOpen;
  snapshot.phase = run.bossPhase;
  snapshot.elapsed = Math.floor(run.time / 1000);
  syncMap(
    snapshot.enemies,
    run.monsters,
    () => new MonsterState(),
    (entry, mob) => {
      Object.assign(entry, mob.body, {
        kind: mob.kind,
        appearance: mob.appearance,
        hp: mob.hp,
        maxHp: mob.maxHp,
        action: mob.ai,
        target: mob.target,
        statuses: [...mob.statuses.keys()].join(", "),
      });
    },
  );
  syncMap(
    snapshot.projectiles,
    run.shots,
    () => new SpellState(),
    (entry, shot) => {
      Object.assign(entry, shot.point, {
        hostile: shot.hostile,
        fx: shot.fx,
        angle: Math.atan2(shot.direction.y, shot.direction.x),
      });
    },
  );
  syncMap(
    snapshot.telegraphs,
    run.areas,
    () => new SpellState(),
    (entry, area) => {
      Object.assign(entry, area.point, {
        fromX: area.origin.x,
        fromY: area.origin.y,
        radius: area.radius,
        width: area.width,
        angle: area.angle,
        hostile: area.hostile,
        fx: area.fx,
      });
    },
  );
  for (const event of run.drainEvents()) publish(event);
  if (run.result && !snapshot.result)
    snapshot.result = JSON.stringify(run.result);
}
