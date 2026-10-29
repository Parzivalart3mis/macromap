# Working on MacroMap

Personal-first nutrition tracker. Most work here is **data** — adding foods from
labels, building recipes, curating stores — not code. The two have different
rules; the distinction below matters more than anything else in this file.

## Database changes

Any write to the database follows three steps, always, including single-row
updates:

1. **Back up first.** Full logical JSON of every table the change touches, plus
   a row-count manifest across all tables, into `.backups/<slug>/` (gitignored).
   For a destructive change, also write a `RESTORE.sql` of ready-to-run
   statements so recovery is one command.
2. **Apply**, scoped as narrowly as the intent — by id where possible, guarded
   on the current value so a re-run is a no-op.
3. **Diff at column level** against the backup. Report row counts before/after,
   which rows changed, and *which columns* moved. Say "INTEGRITY OK" only when
   exactly the intended rows and columns changed and no other table drifted.

**Data changes never produce a git commit.** The database is the artifact.

**Destructive bulk operations — deletes, or clearing a field across many rows —
stop and confirm before running.** Single-row changes act directly.

### Script pattern

Temp script in the project root, deleted after:

```bash
cat > q.tmp.ts <<'EOF'
import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
async function main() { /* ... */ }
main();
EOF
pnpm exec tsx q.tmp.ts 2>&1 | grep -v "injected env"; rm -f q.tmp.ts
```

`neon-http` has **no transactions**. Multi-row writes go in sequence and the
invariant gets asserted afterwards rather than rolled back.

## Code changes

Gate before every commit — all four must pass:

```
pnpm typecheck    clean
pnpm lint         0 errors (warnings have a baseline; don't raise it)
pnpm test
pnpm build
```

Multi-stage work gets **one commit per stage on a green gate**, not one bundle
at the end. Push to `main`.

## Adding food

**Always review first.** Post the nutrition table in chat and wait, for new
items and recalculations alike. Only skip when told to.

Before any insert:

- **Duplicate check** by name *and* by barcode. A near-match usually means
  upgrading the existing row rather than adding a second one — check whether the
  existing values are already correct before assuming otherwise.
- **Follow the nearest sibling.** Find a comparable row and copy its serving
  shape, naming and alternates rather than inventing a form.
- **Verify the label's arithmetic**, don't just transcribe it: %DV against the
  absolute amounts, 4-4-9 against the stated calories, and
  `fiber + sugar ≤ carbs`, `sat + trans ≤ fat`, `added ≤ sugar`. Misprinted %DV
  columns are common — derive from absolute amounts when they disagree.
- **Flag derived or inferred values in chat.** They are not recorded in the row.

## Vocabulary

| Phrase | Means |
|---|---|
| "verified item" | `is_verified = true` — has a canonical nutrition profile: a printed label, or a general food like fruit, nuts or oil |
| "in Yash's food" | `source_type = 'user_created'`, **not** verified — a personal recipe has no canonical profile |
| "in X store" | A menu item: `store_menu_items` with a `menu_category` |
| "in X store (builder)" | A build-your-own ingredient: `store_ingredients` with an `ingredient_group` |

**Store is where you shop; `brand_name` is what's printed on the package.** A
Kroger-brand product bought at Mariano's is a Mariano's item branded Kroger,
exactly as Lucerne items sit under Jewel.

## Conventions

**Serving model.** Count-based units for counted things — `1 pack`, `1 cookie`,
`1 container`, `1 slice` — which suppresses the gram/oz/lb/kg list. Add a
whole-package alternate where the multiplier is useful (`1 box (454 g) ×8.11`).
Reserve weight units for things genuinely measured by weight.

**Descriptions belong to recipes, not products.** `user_created` rows carry an
ingredient list, serving count and the main calorie contributors. Verified items
carry none — the label speaks for itself.

**Diary snapshots are frozen.** Editing a food never rewrites history. When a
correction should reach logged entries, re-snapshot them explicitly and say how
many were touched.

**Surface data problems you weren't asked about** — duplicates, impossible
values, a serving that can't be right. Say it once, then carry on with the task.
