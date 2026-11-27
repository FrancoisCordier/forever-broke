import { CopyButton } from "../components/CopyButton.tsx";
import { ItemName } from "../components/ItemName.tsx";
import { Status } from "../components/Status.tsx";
import { useBuyList } from "../lib/data.ts";
import { formatGold, formatWholeGold } from "../lib/format.ts";
import { goodBuy, type KitPrefs, kitRows, pickKit, useKitPrefs } from "../lib/kit.ts";
import {
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
  select,
  table,
  tableWrap,
  tag,
  tags,
} from "../lib/ui.ts";

export function KitPage() {
  const list = useBuyList();
  const [prefs, setPrefs] = useKitPrefs();
  if (list.state !== "ok") return <Status value={list} />;

  const kits = list.data.kits ?? [];
  const kit = pickKit(kits, prefs);
  if (!kit) return <p className={empty}>No kits in this data yet. They appear after the next collector run.</p>;
  const belowCraftPct = list.data.belowCraftPct ?? 10;
  const rows = kitRows(kit, list.data.items, prefs);
  const wanted = rows.filter((r) => r.need > 0 && r.item);
  const total = wanted.reduce((s, r) => s + r.cost, 0);
  const unpriced = wanted.filter((r) => r.item?.now === null);
  const short = wanted.filter((r) => r.item?.now !== null && r.units < r.need);

  const set = (patch: Partial<KitPrefs>) => setPrefs({ ...prefs, ...patch });

  return (
    <div className="flex flex-col gap-10">
      <section className={pageHead}>
        <div className="flex flex-[1_1_420px] flex-col gap-1.5">
          <h1>My kit</h1>
          <p className={lead}>
            What {prefs.nights} raid {prefs.nights === 1 ? "night costs" : "nights cost"} at today's prices, buying the
            cheapest listings first: <strong className={gold}>{formatWholeGold(total)}</strong>
            {unpriced.length ? (
              <> plus {unpriced.map((r) => r.slot.toLowerCase()).join(", ")} (not listed yet, so not priced)</>
            ) : null}
            .
          </p>
        </div>
        <div className={headControls}>
          {kits.length > 1 ? (
            <div className={field}>
              <label htmlFor="kit" className={label}>
                Kit
              </label>
              <select id="kit" className={select} value={kit.id} onChange={(e) => set({ kit: e.target.value })}>
                {kits.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
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
              onChange={(e) => set({ nights: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
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

      <p className="text-muted">
        {kit.label}. Quantities are per ~3 h raid night; change them to match how you play. Your choices are saved in
        this browser.
      </p>

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
                    {r.dps !== undefined ? (
                      <span className="text-[13px] font-semibold text-gold">+{r.dps} DPS</span>
                    ) : null}
                    {r.note ? <span className={note}>{r.note}</span> : null}
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
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {r.item ? (
                    <ItemName item={r.item} label={r.options.length > 1 ? "Details" : undefined} block />
                  ) : (
                    <span className="text-muted">not on the watchlist</span>
                  )}
                </td>
                <td>
                  <input
                    className={cellInput}
                    type="number"
                    min="0"
                    aria-label={`${r.slot}: units per night`}
                    value={r.perNight}
                    onChange={(e) =>
                      set({
                        perNight: { ...prefs.perNight, [r.key]: Math.max(0, Math.floor(Number(e.target.value) || 0)) },
                      })
                    }
                  />
                </td>
                <td className="text-soft">{r.need}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className={pageFoot}>
        <span>
          <strong>Cost</strong> walks today's listings cheapest first, so it's what clicking through the AH would cost
          right now. It doesn't say where prices go next.
        </span>
      </footer>
    </div>
  );
}
