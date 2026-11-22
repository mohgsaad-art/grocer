# Kurv

A grocery lookout list, stock ledger and spend tracker. Static page on GitHub
Pages, all your data on your phone, prices rebuilt nightly by a GitHub Action.

## Why there's a build step

The Flask version downloaded `latest-canonical.json` on startup. That file is
over 20 MB and `dagligepriser.dk` sends no CORS headers, so a browser on
`yourname.github.io` can neither fetch it nor afford to.

A GitHub Action does it instead. Server-to-server, so CORS never applies. It
replays each item's price history into day-weighted segments and precomputes
the three numbers the phone actually needs, then publishes a slim catalog
alongside the app.

Nothing is committed back to the repo — the Action deploys to Pages as an
artifact, so the repo stays a few hundred kilobytes forever instead of growing
by the size of the dataset every night.

## Setup

1. Create a repository on github.com. **Public** — free Pages needs it. Nothing
   about you goes in here; your lists and purchases never leave your phone.
2. Upload these files, keeping the folder structure:
   ```
   .github/workflows/deploy.yml
   tools/build-data.mjs
   site/index.html
   site/app.css
   site/app.js
   site/view.js
   site/manifest.webmanifest
   site/icon.png
   ```
3. **Settings → Pages → Source: GitHub Actions.** Not "Deploy from a branch" —
   that's the one difference from the SunWatch setup.
4. **Actions** tab → "Build prices and deploy" → **Run workflow**. First run
   takes a couple of minutes, most of it downloading the dataset.
5. Open `https://yourname.github.io/yourrepo/` in Safari → Share → Add to Home
   Screen.

After that it rebuilds at 05:10 UTC daily. Run it manually any time from the
Actions tab.

## Using it

**Plan** — make a list per thing you buy repeatedly (Pasta, Milk), not per
product. Pick the unit it's measured in. Everything converts into that unit, so
a 500 g bag and a 1 kg bag are directly comparable regardless of brand.

Fill in how much you get through in a month, and a **budget price**: the most
you are willing to pay, quoted however you think about it ("15 kr per 500 g").
Those two numbers are the whole budget model. The month's budget is one times
the other, and a saving is what you paid against what that much food was worth
to you.

That price is deliberately yours rather than read off the catalogue. The
earlier version took the baseline from the cheapest regular price on each
lookout list, which moved every time the shops moved, so the month's budget and
every savings figure quietly re-based themselves overnight and no two days could
be compared. A number you chose does not drift.

**Stock is manual.** Add what you bought, and take it off when you eat it.
Earlier versions replayed your monthly rate day by day and drained the cupboard
on their own, which is only true if you eat exactly to plan. Time still spoils
food — anything past its date is swept into waste on its own — but nothing is
eaten unless you say so. The plan rate stays on as a forecast of when you will
run out, which is what it was always good for.

**Eat** plans a day: the cheapest plate that still meets your targets, out of
the cupboard where it can, leaning on whatever is closest to its date. Tapping
"ate it" is what draws the stock down, so the chore that makes manual tracking
collapse becomes one tap — and the optimiser gets an accurate cupboard back in
exchange.

**Today** — search, tap `+` to watch a product. Watched products show a shelf
tag with the discount and, more importantly, how long it has been running. A
discount off an inflated price is not a saving, so an offer that still costs
more per kilo than your budget price is flagged rather than celebrated.

**Stock** — lots with expiry, projected run-out date, projected waste. `✓`
means a pack went faster than planned; `×` means you threw it out. They are
different facts and only the second counts as waste.

**Money** — the month's plan at your budget prices, what the cupboard and your
shopping already cover, what you have spent, and what the offers saved you.
Budget figures never use sale prices: a discounted buy still uses up its
normal-price share and the discount shows up as the saving, so the four numbers
always reconcile.

## Eating well for less

The Eat tab is a small linear program solved on your phone. It decides how many
servings of each dish to eat at each meal, drawing ingredients from the cupboard
or the shop, to minimise

    money spent  −  credit for eating food that is about to spoil
                 +  penalty for missing a nutrient target

subject to your floors and ceilings.

**Everything is editable.** 27 nutrients, each with a floor, a ceiling, whether
the ceiling is soft, and how much it matters when two targets disagree.

**Per day versus per meal.** Nearly everything is judged on the day's total — a
breakfast with no fat in it is fine as long as the day adds up. Only protein,
glycaemic load and a share of the day's energy are judged per meal, because
those are the ones that genuinely do not average out.

**Soft limits by default.** A hard ceiling does not nudge a day, it rebuilds it,
throwing out an otherwise good plate to save the last gram of saturated fat.
Soft says "go over if the alternative is worse", and the plate tells you when it
did and by how much.

**Floors are always elastic.** A floor you cannot reach would make the whole day
infeasible, and "no solution" tells you nothing. Instead you get the best day
available plus "20 g of protein short", which is something you can act on.

**Caps stop the obvious failure.** Without a per-food limit, the cheapest answer
to a 120 g protein target is nine eggs and nothing else — arithmetically correct
and inedible. Every food has a servings-a-day cap; 0 means no limit.

**Some foods are not a meal.** Mark pasta sauce *only in recipes* and it can no
longer be served by the bowl. Left standalone, the optimiser will cheerfully
offer three portions of it and no pasta, because the sauce is where the cheap
micronutrients are and nothing in the arithmetic knows it is inedible that way.
There is a one-tap control for this on the plate itself, which is exactly where
you notice it.

**Recipes are one decision**, so their ingredients can only be eaten in the
ratio you actually cook them in. Note that a recipe never wins on cost alone —
picking its parts separately is always at least as cheap — so there is a small
tie-break credit, and the firmer fix is marking the ingredients recipe-only.

**Food pairings** are the one thing this cannot optimise, and it is worth being
clear why. Lemon on rice lowers its glycaemic response; vitamin C alongside iron
raises how much you absorb; calcium lowers it. Those are effects of two foods
*together*, and a linear model has no way to express one — a coefficient can
only describe a food on its own, so no amount of per-ingredient data will
capture it. The exact way round is to give a recipe its own measured profile
instead of the sum of its parts, which is a switch on every recipe and something
Gemini will estimate for you. Separately, the plate reports a rough absorption
note where it spots an interaction, clearly labelled as a guide rather than a
figure in the totals.

**Nutrition data** can be typed in or filled by Gemini. Paste a key under
Plan → Foods. It goes straight from your browser to Google, is left out of the
backup file, and every number it writes is editable — treat them as a model's
recollection of a food table, not a measurement.

## Data notes

`priceHistory` in the upstream feed records price *changes*, not daily
observations, so the date of the most recent entry is the date the current
price took effect. That's what the freshness tag counts from.

"Usual price" is the time-weighted mode over the trailing year — the price the
item sits at on the most days — not the year high. A year high is one bad
outlier away from making everything look like a bargain.

## Backups

Setup → Export backup. Do it before clearing Safari data or changing phones.
Home-screen apps get a more durable storage bucket than a plain tab, but iOS
will still evict an app you haven't opened in weeks.
