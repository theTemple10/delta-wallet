# Delta — UPDATE: "One transfer home. Every person taken care of."

**Status:** Planned — NOT yet implemented.
**Scope note:** This is a standalone reference for the bulk percentage-payout feature. Everything about this feature lives in this file. It is a separate track from the existing inflow/channel split flow and replaces nothing currently built.

---

## 1. What this is

A single funded balance is split across several beneficiaries **by percentage** and paid out **all at once** over BMONI's smart-wallet rails, with a live feed confirming each payout as it lands.

- One funded balance (the "sender" — the demo version uses Bunch Dillon).
- A handful of beneficiaries, each with a name, a destination, and a share (percentage).
- A single **Send** action that pays every beneficiary directly.
- A live feed showing each payment landing, one by one.
- A simple, responsive, mobile-first screen.

This is conceptually a **payout feed** (one source → many destinations), which is distinct from the existing flow (one inflow → categorised into spend/save/transfer channels). It gets its own data model and screen.

---

## 2. How it works (end-to-end UX flow)

1. The sender opens the Payout screen (`/app/payout`).
2. They see their beneficiaries (pre-seeded demo list, e.g. **Mom**, **Rent**, **Samson**) with an editable **share %** for each.
3. A running total bar shows the sum of shares. It turns amber until the shares sum to **100%**, at which point it turns green and the **Send** button becomes enabled.
4. On **Send**, the backend creates a payout batch, derives each beneficiary's amount (`total × percent / 100`), and starts real BMONI proposal → approve → sign calls for each.
5. The live feed polls batch status and animates each beneficiary from opaque **PENDING** → solidified **PAID** as its proposal completes.
6. When all beneficiaries are PAID, the batch is COMPLETED.

Design language: the existing glassmorphism "state machine as hero" already applies here — a beneficiary starts translucent/ambiguous and firms up once paid. Money going from ambiguous to deliberate.

---

## 3. Design decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Relationship to existing flow | **Standalone** — own tables + own screen | Payouts are payout-centric, not inflow/channel-centric. Avoids entangling the existing proposal/inflow logic. |
| Payout destination (default) | **Beneficiary wallets** via existing BMONI `TRANSFER` (`toUserId`) | Already supported by the codebase and mock mode; works end-to-end in the sandbox once we have the key. |
| Bank-account payouts | **Sealed seam only** — designed for, not implemented | Do NOT invent the BMONI bank-payout API body. Add a seam so only the BMONI-client payout call changes later; app-level flow is untouched. |
| Sender | Bunch Dillon (existing demo user) | Reuses `localStorage` `delta_user_id`. |
| Demo beneficiaries | **Pre-seeded** (Mom / Rent / Samson) + editable form | Fast one-tap demo for judges. |
| Share entry | **Per-send editable %** | Let judges watch the % editing live, then validate to 100. |

---

## 4. Data model

Two new tables plus a joining/detail table. Reuses `ProposalType` and `ProposalStatus` enums where applicable.

### `beneficiaries`
| Field | Type | Notes |
|---|---|---|
| `id` | UUID pk | |
| `sender_user_id` | FK `users.id` | Owner of these beneficiaries |
| `name` | String | Display name |
| `beneficiary_type` | enum `wallet` \| `bank` | Destination kind |
| `bank_account` | String null | Populated for `bank` type (future) |
| `bmoni_user_id` | String null | For `wallet` type — used as BMONI `toUserId` |

### `payout_batches`
| Field | Type | Notes |
|---|---|---|
| `id` | UUID pk | |
| `sender_user_id` | FK `users.id` | |
| `total_amount` | Numeric | The single funded balance |
| `currency` | String | Default `CNGN` |
| `status` | enum `DRAFT` \| `PROCESSING` \| `COMPLETED` \| `PARTIAL` | |

### `payouts`
| Field | Type | Notes |
|---|---|---|
| `id` | UUID pk | |
| `batch_id` | FK `payout_batches.id` | Parent batch |
| `beneficiary_id` | FK `beneficiaries.id` | |
| `percent` | Numeric | Share (validated) |
| `amount` | Numeric | Derived `total × percent / 100` — compute with `Decimal`, never float |
| `bmoni_proposal_id` | String null | Stored proposal id |
| `status` | enum `PENDING` \| `PAID` \| `FAILED` | Mirrors proposal lifecycle for the feed |

Add a `PayoutStatus` enum (and possibly reuse `ProposalStatus`). All money math uses `Decimal` to avoid float drift.

---

## 5. Backend endpoints

New route file `app/routes/payout.py`, registered in `main.py`.

```
POST /beneficiaries                 # add beneficiary (name, type, wallet-ref/bank)
GET  /beneficiaries                 # list the sender's beneficiaries
POST /payout                        # { sender, currency, total, beneficiaries:[{id, percent}] }
                                    #   → validate %, derive amounts, create DRAFT batch + payouts
POST /payout/{batch_id}/send        # for each payout: BMONI proposal → approve → sign; → PAID;
                                    #   batch → COMPLETED
GET  /payout/{batch_id}             # batch + per-payout status (backs the live feed)
```

**Percentage validation rule:**
- Reject if any share ≤ 0 or if the sum ≠ 100 (small tolerance allowed for rounding).
- `amount = total × percent / 100`, computed in `Decimal`.

**Reuse:** the payout send reuses the existing BMONI proposal → approve → sign core (including `unsafe_sign_hash` signing). To keep one code path, factor the existing signing logic in `app/routes/proposals.py` into a shared **proposal-signer service** used by both the inflow flow and payout batches.

**BMONI client addition (`app/services/bmoni_client.py`):**
- `create_transfer_proposal(user_id, wallet_id, to_user_id, amount, currency)` — reuses the existing TRANSFER proposal POST shape.
- `payout_to_bank(...)` — documented seam, **not implemented** until the BMONI bank-payout API is confirmed.

---

## 6. Frontend

- New page `src/pages/PayoutPage.jsx` at route `/app/payout`, added to bottom navigation.
- Beneficiary rows with editable **share %** inputs.
- Running total bar (amber → green at 100%) gating the **Send** button.
- Live-feed polling (`GET /payout/{batch_id}` every ~1.5s) with glassmorphism state machine: translucent **PENDING** → solidified **PAID** (+ checkmark).
- Mobile-first single column.
- Add to `src/services/api.js`: `addBeneficiary`, `listBeneficiaries`, `createPayout`, `sendPayout`, `getPayout`.

---

## 7. Implementation steps (ordered)

1. Backend data model: `beneficiaries`, `payout_batches`, `payouts` + enums.
2. BMONI client: transfer helper + bank-payout seam stub.
3. Shared proposal-signer service (refactor from `app/routes/proposals.py`).
4. Payout routes: create batch, validate %, send, poll status.
5. Frontend: `PayoutPage.jsx`, `api.js` additions, nav link, live feed.
6. PWA/parity: mock fixtures for new endpoints matching real BMONI shapes + PWA icon fixes.
7. Verify: `npm run build`, `npm run lint`, backend boots clean, end-to-end mock test.

---

## 8. Dependencies / prerequisites (sandbox-prep fixes this relies on)

These apply to the wider app and are required for payouts to work in **live** mode:

- **Server-side recipient resolution** — resolve each beneficiary's `bmoni_user_id` (BMONI id) from the DB server-side instead of trusting a client-supplied UUID.
- **Persist `smart_wallet_id`** — currently hardcoded `"default-wallet"` in `proposals.py` / `cards.py`; live mode needs the real wallet id stored on the seeded user.
- **Server-side status polling** — poll BMONI proposal status before marking a payout/proposal COMPLETED (shared signer service).

---

## 9. Open questions (resolve before building)

- Real BMONI `smart_wallet_id` per demo sender — where it lives (persisted on `User` vs per-persona constant).
- Whether BMONI sandbox supports direct bank-account payouts; if/when confirmed, implement the bank-payout seam with the real API body and add a `bank`-type beneficiary UI.
- Live vs mock parity details for the new payout endpoints (mock fixtures must mirror real response shapes).
