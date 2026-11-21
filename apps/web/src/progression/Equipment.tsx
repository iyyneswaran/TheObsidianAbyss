import { useState } from "react";
import { Link } from "react-router-dom";
import {
  wizards,
  wizardDirections,
  wizardSheet,
  type WizardClassId,
} from "@obsidian/game-assets";
import {
  abilitySlots,
  alternate,
  catalog,
  defaultEquipment,
  equippedAbilities,
  loadouts,
  type Equipment,
} from "@obsidian/game-core";
import { PartyConfirm } from "../components/PartyConfirm";
import { api } from "./api";
import {
  Feedback,
  field,
  PageShell,
  panel,
  usePageData,
  WalletBadges,
  type Balance,
} from "./common";

type Item = (typeof catalog)[number] & { owned: boolean };
interface StoreData {
  wallet: Balance;
  items: Item[];
}
interface VaultData {
  owned: string[];
  loadouts: (Equipment & { wizard: string; revision: number })[];
}

function WizardPortrait({
  wizard,
  scale,
}: {
  wizard: WizardClassId;
  scale: number;
}) {
  const cls = wizards[wizard];
  return (
    <div
      role="img"
      aria-label={cls.name}
      className="shrink-0 [image-rendering:pixelated]"
      style={{
        width: wizardSheet.frameWidth * scale,
        height: wizardSheet.frameHeight * scale,
        backgroundImage: `url(${import.meta.env.BASE_URL}${cls.spritePath})`,
        backgroundSize: `${100 * wizardSheet.columns}% ${100 * wizardDirections.length}%`,
      }}
    />
  );
}

function WizardSelect({
  value,
  all,
  onChange,
}: {
  value: string;
  all?: boolean;
  onChange(value: string): void;
}) {
  return (
    <label className="block max-w-xs text-sm">
      Wizard class
      <select
        value={value}
        className={field}
        onChange={(event) => onChange(event.target.value)}
      >
        {all && <option value="">All wizards</option>}
        {Object.values(wizards).map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
    </label>
  );
}

import { preferences } from "../settings/preferences";
export function Store() {
  const { data, setData, error, setError } = usePageData<StoreData>("/store");
  const [wizard, setWizard] = useState("");
  const [currency, setCurrency] = useState<"COINS" | "GEMS">("COINS");
  const [confirm, setConfirm] = useState<{ item: Item; requestKey: string }>();
  const [purchasing, setPurchasing] = useState(false);
  const [notice, setNotice] = useState("");
  async function buy() {
    if (!confirm || purchasing) return;
    setPurchasing(true);
    setError("");
    setNotice("");
    try {
      setData(
        await api<StoreData>("/store/purchase", {
          itemId: confirm.item.id,
          requestKey: confirm.requestKey,
        }),
      );
      setNotice(confirm.item.name + " is now in your Vault.");
      setConfirm(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Purchase failed.");
      setConfirm(undefined);
    } finally {
      setPurchasing(false);
    }
  }
  return (
    <PageShell
      title="The Store"
      detail="Trade earned coins for a Skill 3 alternative or gems for an ultimate."
      badge={data && <WalletBadges balance={data.wallet} />}
    >
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <WizardSelect value={wizard} onChange={setWizard} all />
        <div className="flex gap-2" aria-label="Ability categories">
          <button
            className="action"
            aria-pressed={currency === "COINS"}
            onClick={() => setCurrency("COINS")}
          >
            Skills
          </button>
          <button
            className="action"
            aria-pressed={currency === "GEMS"}
            onClick={() => setCurrency("GEMS")}
          >
            Ultimates
          </button>
        </div>
        <Link className="action ml-auto" to="/vault">
          Open Vault
        </Link>
      </div>
      <Feedback error={error} waiting={!data} />
      {notice && (
        <p
          role="status"
          data-testid="purchase-success"
          className="my-3 text-emerald-200"
        >
          {notice}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.items
          .filter(
            (item) =>
              item.currency === currency && (!wizard || item.wizard === wizard),
          )
          .map((item) => {
            const available =
              item.currency === "COINS" ? data.wallet.coins : data.wallet.gems;
            return (
              <article
                className={panel}
                data-testid="store-item"
                data-item-id={item.id}
                key={item.id}
              >
                <div className="float-right ml-2 grid place-items-center rounded-lg border border-iris/20 bg-[#131121]">
                  <WizardPortrait wizard={item.wizard} scale={1} />
                </div>
                <p
                  className="text-xs uppercase tracking-wider"
                  style={{ color: wizards[item.wizard].primaryColor }}
                >
                  {wizards[item.wizard].name}
                </p>
                <h2 className="mt-1 font-serif text-2xl text-gold">
                  {item.name}
                </h2>
                <p className="mt-2 min-h-10 text-sm text-slate-300">
                  {item.description}
                </p>
                <p className="mt-2 text-xs text-iris">
                  {item.mana} MP · {(item.cooldownMs / 1000).toFixed(1)} s
                  cooldown
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-gold">
                    {item.price} {item.currency.toLowerCase()}
                  </span>
                  <button
                    className="action"
                    disabled={item.owned || available < item.price}
                    onClick={() =>
                      setConfirm({ item, requestKey: crypto.randomUUID() })
                    }
                  >
                    {item.owned
                      ? "Owned"
                      : available < item.price
                        ? "Insufficient funds"
                        : "Purchase"}
                  </button>
                </div>
              </article>
            );
          })}
      </div>
      {confirm && (
        <PartyConfirm
          title={confirm.item.name}
          detail={`Spend ${confirm.item.price} ${confirm.item.currency.toLowerCase()} to own this ability and equip it in the Vault.`}
          confirm={purchasing ? "Purchasing…" : "Confirm purchase"}
          onCancel={() => {
            if (!purchasing) setConfirm(undefined);
          }}
          onConfirm={() => void buy()}
        />
      )}
    </PageShell>
  );
}

export function Vault() {
  const { data, setData, error, setError } = usePageData<VaultData>("/vault");
  const [wizard, setWizard] = useState<WizardClassId>("fire");
  const [edits, setEdits] = useState<Partial<Record<WizardClassId, Equipment>>>(
    {},
  );
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const persisted =
    data?.loadouts.find((entry) => entry.wizard === wizard) ?? defaultEquipment;
  const draft = edits[wizard] ?? persisted;
  const effective = equippedAbilities(wizard, draft);
  const cls = wizards[wizard];
  const coin = catalog.find(
    (item) => item.wizard === wizard && item.slot === "SKILL_3",
  )!;
  const gem = catalog.find(
    (item) => item.wizard === wizard && item.slot === "ULTIMATE",
  )!;
  async function save() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setData(
        await api<VaultData>("/vault/equip", {
          wizard,
          skill3: draft.skill3,
          ultimate: draft.ultimate,
        }),
      );
      setNotice("Loadout saved for future runs.");
      setEdits((all) => {
        const next = { ...all };
        delete next[wizard];
        return next;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <PageShell
      title="The Vault"
      detail="Equip abilities before the next dungeon. A started run keeps its locked loadout."
      badge={
        <Link className="action" to="/store">
          Open Store
        </Link>
      }
    >
      <Feedback error={error} waiting={!data} />
      <div className="grid gap-4 lg:grid-cols-[0.7fr_1.5fr]">
        <section className={panel}>
          <WizardSelect
            value={wizard}
            onChange={(value) => {
              setWizard(value as WizardClassId);
              setNotice("");
            }}
          />
          <div
            className="my-6 grid min-h-32 place-items-center rounded-lg border border-iris/30"
            style={{
              backgroundImage: `radial-gradient(ellipse at 50% 58%, ${cls.primaryColor}38, #151427 72%)`,
            }}
          >
            <WizardPortrait wizard={wizard} scale={2} />
          </div>
          <label className="mb-4 block text-sm">
            Skill 3 ({preferences().keys.SKILL_3})
            <select
              className={field}
              value={draft.skill3 ?? ""}
              onChange={(event) =>
                setEdits({
                  ...edits,
                  [wizard]: { ...draft, skill3: event.target.value || null },
                })
              }
            >
              <option value="">
                {loadouts[wizard].abilities.SKILL_3.name} · Default
              </option>
              <option value={coin.id} disabled={!data?.owned.includes(coin.id)}>
                {coin.name}
                {data?.owned.includes(coin.id) ? "" : " · Locked"}
              </option>
            </select>
          </label>
          <label className="block text-sm">
            Ultimate ({preferences().keys.ULTIMATE})
            <select
              className={field}
              value={draft.ultimate ?? ""}
              onChange={(event) =>
                setEdits({
                  ...edits,
                  [wizard]: { ...draft, ultimate: event.target.value || null },
                })
              }
            >
              <option value="">
                {loadouts[wizard].abilities.ULTIMATE.name} · Default
              </option>
              <option value={gem.id} disabled={!data?.owned.includes(gem.id)}>
                {gem.name}
                {data?.owned.includes(gem.id) ? "" : " · Locked"}
              </option>
            </select>
          </label>
          <button
            className="action mt-4"
            disabled={!data || busy}
            onClick={() => void save()}
          >
            Save loadout
          </button>
          {notice && (
            <p role="status" className="mt-3 text-sm text-emerald-200">
              {notice}
            </p>
          )}
        </section>
        <section className={panel}>
          <h2 className="font-serif text-2xl text-gold">Loadout preview</h2>
          <ul className="mt-3 space-y-2">
            {abilitySlots.map((slot, i) => {
              const ability = effective[slot];
              const equipped =
                slot === "SKILL_3"
                  ? alternate(wizard, slot, draft.skill3)
                  : slot === "ULTIMATE"
                    ? alternate(wizard, slot, draft.ultimate)
                    : undefined;
              return (
                <li
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-iris/25 bg-[#16152b] px-3 py-2.5"
                  data-testid="vault-slot"
                  key={slot}
                  data-slot={slot}
                >
                  <p>
                    <kbd className="mr-3 text-xs text-iris">
                      {["LMB", "Q", "E", "R", "F"][i]}
                    </kbd>
                    <span className="font-semibold">{ability.name}</span>
                    {equipped && (
                      <span className="ml-2 text-xs text-gold">Alternate</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-300">
                    {ability.mana} MP · {(ability.cooldownMs / 1000).toFixed(1)}{" "}
                    s
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </PageShell>
  );
}
