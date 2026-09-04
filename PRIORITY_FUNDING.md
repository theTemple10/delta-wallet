# Delta — ADDON: Priority-Aware Channel Funding ("what happens when the money isn't enough")

**Status:** Planned — build tonight if time allows. **Scope note:** This extends the existing
inflow → propose-split flow. It does NOT touch the payout-batch feature in `UPDATE.md` (separate,
still not implemented). This is the highest-leverage differentiator in the product — prioritize it
over anything else non-essential.

---

## 1. The problem this solves

Today, every inflow is treated as a one-shot, independent event: an amount lands, gets split across
channels, done. Real income doesn't work that way — a Nigerian fellow getting paid irregularly deals
with two recurring situations Delta currently has no answer for:

1. **This inflow isn't enough to cover everything.** Rent, savings, and discretionary spend can't all
   get their full target amount. Right now the split logic has no defined behavior for this — it just
   proposes whatever it proposes, seemingly independent of whether the total makes sense.
2. **A second inflow lands later in the same period.** There's no concept of "this channel already got
   ₦20,000 toward its ₦50,000 monthly target" — every inflow starts from zero, ignoring prior funding
   in the period.

This is not a nice-to-have. It's the difference between "an app that splits a number" and "an app that
understands how a person actually gets paid."

---

## 2. Design decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Funding policy | **Priority waterfall**, not proportional scale-down | "Rent gets paid before discretionary spend, always" is instantly understandable and trustworthy in a pitch. Proportional scaling is fairer but weaker to demo and explain. |
| Period tracking | Each channel has a `target_amount` + `period` (default `monthly`) | Needed so a later inflow knows what's already been funded this period, not just what this one inflow looks like in isolation. |
| Carry-forward | Channels **remember funded-so-far** within the current period | This is what makes "a second payment later in the month" behave correctly — top up shortfalls first, don't re-split from zero. |
| Manual mode | Same waterfall logic, but user can drag-reorder priority live before confirming | Keeps the "AI is optional, execution is not" principle — priority ordering is a first-class manual control, not just an AI internal. |
| Rounding/money math | `Decimal` everywhere, never float | Matches the existing convention from `UPDATE.md`. |

---

## 3. Data model changes

Extend the existing `channels` table (no new table needed):

| Field | Type | Notes |
|---|---|---|
| `target_amount` | Numeric, nullable | The channel's full target for one period. Null = "take remainder" / discretionary, always lowest priority. |
| `period` | enum `monthly` \| `weekly` \| `one_off` | Default `monthly`. |
| `priority_rank` | Integer | Lower = funded first. Obligations (rent, family transfer) default lowest number; discretionary spend defaults highest. |
| `funded_amount` | Numeric, default 0 | Running total funded **within the current period**. Reset to 0 when a new period starts (simplest: compare `updated_at`/a stored `period_start` against now). |

Add `period_start` (Date) if you want explicit period boundaries rather than inferring from timestamps —
simpler and less bug-prone with your remaining time, do this.

---

## 4. Allocation algorithm

Given an inflow amount `A` and the user's channels sorted by `priority_rank` ascending:

```
remaining = A
for channel in channels_sorted_by_priority:
    shortfall = max(channel.target_amount - channel.funded_amount, 0)   # 0 if no target (discretionary)
    allocation = min(shortfall, remaining)   # or, for the discretionary/no-target channel, allocation = remaining
    propose(channel, allocation)
    remaining -= allocation
    if remaining <= 0:
        break
# any leftover after all channels are fully funded this period → discretionary/spend channel, or flagged as "surplus"
```

This single function handles **both** stated problems: insufficient inflow (higher-priority channels
get funded first, lower-priority get partial or nothing) and a later top-up inflow (shortfall is computed
against `funded_amount`, so already-funded channels are correctly skipped or only partially topped up).

**Groq's role changes slightly:** instead of asking the model to invent amounts from scratch, feed it the
computed shortfall list and ask only for the one-line human reasons per channel (it already does this per
`delta-build-prompt.md` section 8) — the waterfall math itself should be deterministic backend code, not
LLM output, since judges will trust "the money math is a real algorithm" far more than "the money math is
whatever the model said."

---

## 5. Backend changes

- `app/routes/split.py` (`POST /inflow/{id}/propose-split`): replace the current split logic with the
  waterfall function above. Response shape stays the same (`{channel_id, amount, reason}` array) — no
  frontend contract break beyond what's in section 6.
- After a proposal reaches `COMPLETED` status, increment that channel's `funded_amount` by the completed
  amount. Do this in whichever route currently marks proposals complete (`proposals.py`'s sign/poll path).
- Add a lightweight period-rollover check: on any read of a channel, if `now` is past `period_start +
  period length`, reset `funded_amount` to 0 and bump `period_start`. No cron job needed for a hackathon
  build — check-on-read is enough.

---

## 6. Frontend changes

- **Channel setup / edit** (wherever channels are created/edited): add `target_amount`, `period`, and a
  drag-to-reorder priority list. Keep it simple — a numbered list with up/down arrows is enough, don't
  build real drag-and-drop tonight unless time allows.
- **SplitPage.jsx**: show each channel's **shortfall** explicitly ("Rent — ₦20,000 of ₦50,000 funded this
  month, needs ₦30,000") before showing the proposed allocation. This visual — target vs funded vs
  proposed — is the actual "aha" moment for judges. Spend real design time here, this is the single most
  differentiating screen in the whole product.
- A small **"fully funded"** badge/checkmark state for channels that hit their target — reuses your
  existing glassmorphism "solidify on completion" visual language, just applied to the channel's period
  progress instead of just proposal status.

---

## 7. Demo script for this feature specifically

1. Seed users, send a modest inflow that's clearly not enough to cover all channel targets.
2. Show the waterfall in action: obligations funded first, discretionary channel gets little or nothing,
   with the shortfall clearly visible per channel.
3. Send a **second** inflow later in the same demo. Show that already-funded channels are skipped/topped
   up correctly instead of re-splitting from scratch — this is the moment that proves it's not just a
   percentage splitter.

---

## 8. If time runs out

If you can only build part of this tonight, build **section 4 (allocation algorithm) + the shortfall
display in section 6** and skip drag-to-reorder priority editing — hardcode priority order at channel
creation (obligations before savings before discretionary) and mention live reordering as "next" in the
pitch. The algorithm + visible shortfall is what makes the demo land; editable ordering is polish.
