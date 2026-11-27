import { useId, useState } from "react";
import { useSearchParams } from "react-router";
import type { BuyListItem, Kit } from "../../../src/shared/signals.ts";
import { CopyButton } from "../components/CopyButton.tsx";
import { ItemName } from "../components/ItemName.tsx";
import { Status } from "../components/Status.tsx";
import { isVendor } from "../lib/buylist.ts";
import { adopt, customise, decodeKit, encodeKit, isCustom, useCustomKits } from "../lib/customKits.ts";
import { useBuyList } from "../lib/data.ts";
import { formatGold, formatWholeGold } from "../lib/format.ts";
import {
  goodBuy,
  type KitPrefs,
  type KitRow,
  kitRows,
  kitsByClass,
  pickKit,
  useKitPrefs,
  withClass,
} from "../lib/kit.ts";
import {
  btn,
  card,
  cellInput,
  cellSelect,
  empty,
  field,
  gold,
  headControls,
  label,
  lead,
  note,
  notice,
  numberInput,
  pageFoot,
  pageHead,
  segment,
  table,
  tableWrap,
  tag,
  tags,
  textInput,
} from "../lib/ui.ts";

/** The game's class colours, as a dot in the class picker. Literal classes: Tailwind only sees written-out names. */
const CLASS_DOT: Record<string, string> = {
  Druid: "text-[#ff7c0a]",
  Hunter: "text-[#aad372]",
  Mage: "text-[#3fc7eb]",
  Paladin: "text-[#f48cba]",
  Priest: "text-[#ffffff]",
  Rogue: "text-[#fff468]",
  Shaman: "text-[#0070dd]",
  Warlock: "text-[#8788ee]",
  Warrior: "text-[#c69b6d]",
};

/** A legend that sits on the same line as its buttons: floated, since a legend ignores the fieldset's flex. */
const PICK_LEGEND = "float-left mr-1.5 w-12 text-xs font-medium text-muted";

const wholeNumber = (v: string) => Math.max(0, Math.floor(Number(v) || 0));

function KitPicker({ kits, kit, onPick }: { kits: Kit[]; kit: Kit; onPick: (id: string) => void }) {
  const classes = kitsByClass(kits);
  const specs = classes.find(([c]) => c === kit.class)?.[1] ?? [kit];
  return (
    <div className="flex flex-col gap-2.5">
      <fieldset className="m-0 flex flex-wrap items-center gap-1.5 border-0 p-0">
        <legend className={PICK_LEGEND}>Class</legend>
        {classes.map(([cls, ks]) => (
          <button
            key={cls}
            type="button"
            aria-pressed={cls === kit.class}
            className={segment}
            onClick={() => onPick(ks[0].id)}
          >
            <span aria-hidden="true" className={CLASS_DOT[cls] ?? "text-muted"}>
              ●
            </span>{" "}
            {cls}
          </button>
        ))}
      </fieldset>
      <fieldset className="m-0 flex flex-wrap items-center gap-1.5 border-0 p-0">
        <legend className={PICK_LEGEND}>Spec</legend>
        {specs.map((k) => (
          <button
            key={k.id}
            type="button"
            aria-pressed={k.id === kit.id}
            className={segment}
            onClick={() => onPick(k.id)}
          >
            {isCustom(k) ? `★ ${k.label}` : k.spec}
          </button>
        ))}
      </fieldset>
    </div>
  );
}

/** Add an item to a custom kit: as another option of a slot, or as a new slot. */
function AddItem({ kit, items, onChange }: { kit: Kit; items: BuyListItem[]; onChange: (k: Kit) => void }) {
  const id = useId();
  const [target, setTarget] = useState("");
  const [slotName, setSlotName] = useState("");
  const [name, setName] = useState("");
  const [perNight, setPerNight] = useState(6);
  const choices = items.filter((x) => !isVendor(x)).sort((a, b) => a.name.localeCompare(b.name));
  const item = choices.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
  const newSlot = target === "";
  const slot = (slotName.trim() || item?.name || "").slice(0, 60);
  const taken = newSlot && kit.slots.some((s) => s.slot === slot);
  const ok = item !== undefined && (!newSlot || (slot !== "" && !taken));

  const add = () => {
    if (!item || !ok) return;
    onChange({
      ...kit,
      slots: newSlot
        ? [...kit.slots, { slot, perNight, options: [item.id] }]
        : kit.slots.map((s) =>
            s.slot === target && !s.options.includes(item.id) ? { ...s, options: [...s.options, item.id] } : s,
          ),
    });
    setName("");
    setSlotName("");
  };

  return (
    <section aria-labelledby={`${id}-h`} className={`${card} flex flex-col gap-3`}>
      <h2 id={`${id}-h`} className="text-base">
        Add an item
      </h2>
      <div className="flex flex-wrap items-end gap-3">
        <div className={field}>
          <label htmlFor={`${id}-item`} className={label}>
            Item (watchlist)
          </label>
          <input
            id={`${id}-item`}
            className={textInput}
            list={`${id}-items`}
            placeholder="Start typing a name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <datalist id={`${id}-items`}>
            {choices.map((x) => (
              <option key={x.id} value={x.name} />
            ))}
          </datalist>
        </div>
        <div className={field}>
          <label htmlFor={`${id}-to`} className={label}>
            Add to
          </label>
          <select id={`${id}-to`} className={cellSelect} value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">A new slot</option>
            {kit.slots.map((s) => (
              <option key={s.slot} value={s.slot}>
                {s.slot} (as an alternative)
              </option>
            ))}
          </select>
        </div>
        {newSlot ? (
          <>
            <div className={field}>
              <label htmlFor={`${id}-slot`} className={label}>
                Slot name
              </label>
              <input
                id={`${id}-slot`}
                className={textInput}
                placeholder={item?.name ?? "e.g. Fire resistance"}
                value={slotName}
                onChange={(e) => setSlotName(e.target.value)}
              />
            </div>
            <div className={field}>
              <label htmlFor={`${id}-pn`} className={label}>
                Per night
              </label>
              <input
                id={`${id}-pn`}
                className={cellInput}
                type="number"
                min="0"
                value={perNight}
                onChange={(e) => setPerNight(wholeNumber(e.target.value))}
              />
            </div>
          </>
        ) : null}
        <button type="button" className={btn("primary")} disabled={!ok} onClick={add}>
          Add
        </button>
      </div>
      {taken ? <p className="text-[13.5px] text-loss">This kit already has a slot called “{slot}”.</p> : null}
      {name && !item ? (
        <p className="text-[13.5px] text-muted">Pick a name from the list: only watchlist items have prices.</p>
      ) : null}
    </section>
  );
}

function SourceLine({ kit, base }: { kit: Kit; base?: Kit }) {
  if (isCustom(kit))
    return (
      <p className="text-muted">
        Your own kit{base ? `, started from ${base.label}` : ""}. Saved in this browser only: <strong>Copy link</strong>{" "}
        moves it to another device or a guildmate.
      </p>
    );
  if (!kit.source) return null;
  return (
    <p className="text-muted">
      List from{" "}
      <a href={kit.source.url} target="_blank" rel="noopener">
        {kit.source.name}
      </a>
      , updated {kit.source.date}.{" "}
      {kit.slots.some((s) => s.dps !== undefined)
        ? "DPS = what you lose without that one item, with everything else on."
        : "In the guide's order."}
    </p>
  );
}

export function KitPage() {
  const list = useBuyList();
  const [prefs, setPrefs] = useKitPrefs();
  const [custom, setCustom] = useCustomKits();
  const [params, setParams] = useSearchParams();
  if (list.state !== "ok") return <Status value={list} />;

  const defaults = withClass(list.data.kits ?? []);
  const kits = [...defaults, ...custom];
  const kit = pickKit(kits, prefs);
  const shared = params.get("share") ? decodeKit(params.get("share") ?? "") : null;
  if (!kit) return <p className={empty}>No kits in this data yet. They appear after the next collector run.</p>;

  const soulbound = new Set(list.data.soulbound ?? []);
  const belowCraftPct = list.data.belowCraftPct ?? 10;
  const rows = kitRows(kit, list.data.items, prefs, soulbound);
  const wanted = rows.filter((r) => r.need > 0 && r.item && !r.soulbound);
  const farm = rows.filter((r) => r.need > 0 && r.soulbound);
  const total = wanted.reduce((s, r) => s + r.cost, 0);
  const unpriced = wanted.filter((r) => r.item?.now === null);
  const short = wanted.filter((r) => r.item?.now !== null && r.units < r.need);
  const editable = isCustom(kit);
  const hasDps = rows.some((r) => r.dps !== undefined);

  const set = (patch: Partial<KitPrefs>) => setPrefs({ ...prefs, ...patch });
  const saveKit = (k: Kit) => setCustom(custom.map((c) => (c.id === k.id ? k : c)));
  const addKit = (k: Kit) => {
    setCustom([...custom, k]);
    set({ kit: k.id });
  };
  const deleteKit = () => {
    if (!window.confirm(`Delete “${kit.label}”? This can't be undone.`)) return;
    setCustom(custom.filter((c) => c.id !== kit.id));
    set({ kit: defaults.find((d) => d.class === kit.class)?.id ?? "" });
  };
  const removeSlot = (r: KitRow) => saveKit({ ...kit, slots: kit.slots.filter((s) => s.slot !== r.slot) });
  const removeOption = (r: KitRow) =>
    saveKit({
      ...kit,
      slots: kit.slots.map((s) =>
        s.slot === r.slot ? { ...s, options: s.options.filter((o) => o !== r.item?.id) } : s,
      ),
    });
  const shareUrl = `${window.location.origin}${window.location.pathname}#/kit?share=${encodeKit(kit)}`;
  const base = defaults.find((d) => d.class === kit.class && kit.label === `My ${d.spec}`);

  return (
    <div className="flex flex-col gap-8">
      {shared ? (
        <div className={`${notice} flex flex-wrap items-center gap-3`}>
          <span className="flex-auto">
            Someone shared a kit with you: <strong>{shared.label}</strong> ({shared.slots.length} slots).
          </span>
          <button
            type="button"
            className={btn("primary", true)}
            onClick={() => {
              addKit(adopt(shared));
              setParams({});
            }}
          >
            Add to my kits
          </button>
          <button type="button" className={btn("ghost", true)} onClick={() => setParams({})}>
            Dismiss
          </button>
        </div>
      ) : null}

      <section className={pageHead}>
        <div className="flex flex-[1_1_420px] flex-col gap-1.5">
          <h1>My kit</h1>
          <p className={lead}>
            What {prefs.nights} raid {prefs.nights === 1 ? "night costs" : "nights cost"} at today's prices, buying the
            cheapest listings first: <strong className={gold}>{formatWholeGold(total)}</strong>
            {unpriced.length ? (
              <> plus {unpriced.map((r) => r.slot.toLowerCase()).join(", ")} (not listed yet, so not priced)</>
            ) : null}
            {farm.length ? <>; {farm.map((r) => r.item?.name).join(", ")} you farm yourself (soulbound)</> : null}.
          </p>
        </div>
        <div className={headControls}>
          <div className={field}>
            <label htmlFor="nights" className={label}>
              Raid nights
            </label>
            <input
              id="nights"
              className={numberInput}
              type="number"
              min="1"
              max="30"
              value={prefs.nights}
              onChange={(e) => set({ nights: wholeNumber(e.target.value) })}
            />
          </div>
          {wanted.length > 0 ? (
            <CopyButton
              text={wanted.map((r) => r.item?.name ?? "").join("\n")}
              label="Copy shopping list"
              done={`Copied ${wanted.length} item names, one per line`}
              variant="secondary"
            />
          ) : null}
        </div>
      </section>

      <section aria-label="Choose a kit" className="flex flex-col gap-3">
        <KitPicker kits={kits} kit={kit} onPick={(id) => set({ kit: id })} />
        <SourceLine kit={kit} base={base} />
        <div className="flex flex-wrap items-end gap-3">
          {editable ? (
            <>
              <div className={field}>
                <label htmlFor="kit-name" className={label}>
                  Kit name
                </label>
                <input
                  id="kit-name"
                  className={textInput}
                  value={kit.label}
                  maxLength={60}
                  onChange={(e) => saveKit({ ...kit, label: e.target.value })}
                />
              </div>
              <CopyButton
                text={shareUrl}
                label="Copy link"
                done="Link copied: opening it offers to add this kit"
                variant="secondary"
              />
              <button type="button" className={btn("ghost")} onClick={deleteKit}>
                Delete kit
              </button>
            </>
          ) : null}
          <button type="button" className={btn("secondary")} onClick={() => addKit(customise(kit, rows))}>
            {editable ? "Duplicate" : "Customise"}
          </button>
          {!editable ? (
            <span className="text-[13.5px] text-muted">Make your own copy to remove or add items.</span>
          ) : null}
        </div>
      </section>

      {short.length ? (
        <p className={notice}>
          Not enough listed among the cheapest offers for: {short.map((r) => `${r.item?.name} (${r.units})`).join(", ")}
          . The rest would cost more.
        </p>
      ) : null}

      <div className={tableWrap}>
        <table className={table}>
          <thead>
            <tr>
              <th scope="col">Slot</th>
              <th scope="col">Item</th>
              <th scope="col">Per night</th>
              <th scope="col">Need</th>
              <th scope="col">Now</th>
              <th scope="col">Cost</th>
              <th scope="col">Units listed</th>
              <th scope="col">Why buy now</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="min-w-55">
                  <div className="flex flex-col gap-1.5">
                    <strong>{r.slot}</strong>
                    {hasDps && r.dps !== undefined ? (
                      <span className="text-[13px] font-semibold text-gold">+{r.dps} DPS</span>
                    ) : null}
                    {r.note ? <span className={note}>{r.note}</span> : null}
                    {editable ? (
                      <button
                        type="button"
                        className={`${btn("ghost", true)} self-start`}
                        onClick={() => removeSlot(r)}
                      >
                        Remove slot
                      </button>
                    ) : null}
                  </div>
                </td>
                <td>
                  {r.options.length > 1 ? (
                    <select
                      className={cellSelect}
                      aria-label={`${r.slot}: item`}
                      value={r.item?.id}
                      onChange={(e) => set({ choice: { ...prefs.choice, [r.key]: Number(e.target.value) } })}
                    >
                      {r.options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                          {soulbound.has(o.id) ? " (soulbound)" : ""}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {r.item ? (
                    <ItemName item={r.item} label={r.options.length > 1 ? "Details" : undefined} block />
                  ) : (
                    <span className="text-muted">not on the watchlist</span>
                  )}
                  {editable && r.options.length > 1 ? (
                    <button type="button" className={`${btn("ghost", true)} mt-1.5`} onClick={() => removeOption(r)}>
                      Remove this option
                    </button>
                  ) : null}
                </td>
                <td>
                  <input
                    className={cellInput}
                    type="number"
                    min="0"
                    aria-label={`${r.slot}: units per night`}
                    value={r.perNight}
                    onChange={(e) => set({ perNight: { ...prefs.perNight, [r.key]: wholeNumber(e.target.value) } })}
                  />
                </td>
                <td className="text-soft">{r.need}</td>
                {r.soulbound ? (
                  <>
                    <td className="text-muted">soulbound</td>
                    <td className="text-muted">farm it</td>
                    <td className="text-muted">—</td>
                    <td>
                      <div className={tags}>
                        <span className={tag.plain}>Farm or quest: never on the AH</span>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className={r.item?.now == null ? "text-muted" : gold}>
                      {r.item?.now == null ? "not listed" : formatGold(r.item.now)}
                    </td>
                    <td className={gold}>{r.need && r.item?.now != null ? formatGold(r.cost) : "—"}</td>
                    <td className="text-soft">{r.item ? r.item.qty.toLocaleString("en-GB") : "—"}</td>
                    <td>
                      <div className={tags}>
                        {(r.item ? (goodBuy(r.item, belowCraftPct)?.reasons ?? []) : []).map((why) => (
                          <span key={why} className={tag.cheap}>
                            {why}
                          </span>
                        ))}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editable ? <AddItem kit={kit} items={list.data.items} onChange={saveKit} /> : null}

      <footer className={pageFoot}>
        <span>
          <strong>Cost</strong> walks today's listings cheapest first, so it's what clicking through the AH would cost
          right now. It doesn't say where prices go next.
        </span>
        <span>
          <strong>Per night</strong> starts from each item's duration over a ~3 h raid (a 30 min elixir: 6). Change it
          to match how you play; your choices are saved in this browser.
        </span>
        <span>
          <strong>Soulbound</strong> items (Juju, Blasted Lands buffs, Demonic Rune…) bind when picked up, so the AH
          never has them: they're left out of the cost and the shopping list.
        </span>
      </footer>
    </div>
  );
}
