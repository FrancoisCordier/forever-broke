# Raid prep research (Forever-specific)

Everything below comes from the API (`static-forever-eu`) on 2026-11-25: recipes from
`pnpm fetch-recipes` → `recipes.json`, effects from item tooltips. Prices are house 110 snapshots
from 2026-11-25 16:22 UTC and only illustrate scale. Live numbers come from the collector.

## Headline: the four new flasks are raid-specific

| Flask              | ID     | Effect (all: +30 Sta, 2 h, persists through death)     | Reagents                                                          |
| ------------------ | ------ | ------------------------------------------------------ | ----------------------------------------------------------------- |
| Natural Accuracy   | 274273 | +2% hit **in Mount Hyjal, Hyjal Summit, Barrow Deeps** | 1 Death Lotus, 12 Demonsage, 9 Golden Sansam, 1 Imbued Vial       |
| Natural Aggression | 274274 | +2% crit (same zones)                                  | 1 Death Lotus, 18 Demonsage, 6 Mountain Silversage, 1 Imbued Vial |
| Natural Precision  | 274275 | −2% chance to be dodged/parried (same zones)           | 1 Death Lotus, 12 Marefoil, 9 Dreamfoil, 1 Imbued Vial            |
| Natural Swiftness  | 274276 | +2% haste (same zones)                                 | 1 Death Lotus, 18 Marefoil, 6 Icecap, 1 Imbued Vial               |

- Recipes (274277–274280) are RARE quality, so probably drops or reputation rewards. **Not one of these flasks
  was listed on any house** on 25 Nov. Few players can craft them yet.
- The zone restriction is exactly the three raids opening on 9 Dec. Expect demand for these flasks, and
  so for their reagents, from raid opening.
- Flask of the Titans (13510) recipe confirmed as in Classic: 30 Gromsblood, 10 Stonescale Oil, 1 Black Lotus, 1 Crystal Vial.

## New gathered reagents (not craftable)

| Item        | ID     | Used in                                                                                                   | 110 snapshot                                                                |
| ----------- | ------ | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Death Lotus | 248822 | 4 flasks + 5 others (Natural Power/Lotus Claw glove enchants, Legionite Glaive, battery, weather machine) | ~6g p10, 229 units                                                          |
| Demonsage   | 248821 | Accuracy, Aggression                                                                                      | ~49s, 817 units                                                             |
| Marefoil    | 248823 | Precision, Swiftness, Stealthman 52                                                                       | ~73s, 1,389 units                                                           |
| Imbued Vial | 18256  | 14 recipes                                                                                                | 60s, which matches its vendor price (30,000c per 5), so **don't stockpile** |

Demand per flask: 12–18 Demonsage or Marefoil. One raider using one flask per raid night needs ~15 herbs a night.

## New level-55 consumables (raid-relevant candidates)

- **Elixirs** (30 min): Cunning (+25 Agi/Int), Phalanx (+400 HP/+500 armor), Owl (+25 Int, +2% crit),
  Sages (+25 Spi, +2% crit), Grizzly (+25 Str, +2% crit), Ferocity (+18 Str/Agi), Greater Mageblood,
  Greater Cleric's (+40 healing), Nature Power (+40 nature dmg), Greater Fortitude (+400 HP).
  Most use Classic herbs (Dreamfoil, Gromsblood, Golden Sansam, Sungrass…), which **adds demand to Classic herbs**.
- **Potions** (30 s, 2 min CD): Major Spellblasting (+47 spell dmg), Major Frenzy (+80 AP), Major Mender's (+88 healing).
  These are new burst potions that would sit beside Classic Major Mana/Healing.
- Sweetpaw Jam (Hyjal food, uses Hyjal Berries), EZ-Thro Dark Bomb / Thorium Grenade, Forceful/Mystic Rugged Armor Kits.
- Crafting materials for new gear: Fel Crystal (~9.8g), Legionite Bar (~34g, from Transmute: Legionite), Fel Hide (~4g), Heavy Thorium Bar.

The consumables above are in `config.yaml` → `watchlist.forever_raid` (hourly history). The gear crafting
materials were dropped from the watchlist on 2026-11-26 (scope: raid consumables and their reagents). Their
daily history is still recorded (ADR-0004).

## Classic items Forever changed (item tooltips, 2026-11-26)

- **Grilled Squid** (13928): well fed = **+1% crit** for 15 min (not +10 Agi).
- **Potion of Demon Slaying** (9224): +180 AP against demons for 5 min, 2 min cooldown. Only worth something if
  the new raids' bosses are demons, which nothing confirms yet.
- **Major Frenzy Potion** (250943) says "+80 Attack Power". Whether that includes ranged AP is untested.
- Never listed on any house so far, so probably not released yet: Juju Power/Might, R.O.I.D.S., Ground Scorpok
  Assay, Cerebral Cortex Compound, Brilliant Wizard/Mana Oil, Elemental Sharpening Stone.

## Craft cost of the Natural flasks (2026-11-26)

At house 110 prices, reagents for one Natural flask cost 18–19.5g, most of it the Death Lotus (11.55g, up from
~6g the day before). None is listed yet. Expect them to list at that or above.

## Unknowns

- Which elixirs actually stack (battle vs guardian). The API tooltip doesn't say.
- Whether Death Lotus supply grows once more players reach the zones where it spawns.
  **Stockpiling bets on demand outpacing supply. The data will show it; it is not guaranteed.**
- "Season of Discovery" recipe categories also exist in the data. They're excluded here, since nothing shows they're live in Forever.
