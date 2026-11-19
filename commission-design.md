# Kherja — Commission design (DESIGN ONLY, nothing implemented)

Status: **proposal for approval.** No code, schema, UI, charge or percentage was added in Phase 2.1.
Anything marked **[DECIDED]** is already true in the running system. Anything marked **[UNDECIDED]** needs a business decision. Anything marked **[PROPOSED]** is a recommended default that still needs approval. **No commission rate, fee amount, threshold or cap is proposed here; every number is a placeholder to be set by the business.**

## 1. Principle: commission is separate from `locked_price`

- **[DECIDED] `rides.locked_price` is the negotiated fare.** It is copied from the accepted offer at accept time (`server.js`, `POST /api/offers/:id/accept`) and a database trigger (`lock_price`, `migrations/001_init.sql`) aborts any `UPDATE` of it. Phase 2.1 did not touch this.
- **[PROPOSED]** Commission never reads from, writes to, or alters `locked_price`, `offers.price` or `requests.price`. It lives in its own table and is computed *from* `locked_price` (read-only), never folded into it.
- **[PROPOSED] Rider-facing invariant:** the amount the rider agrees to is the amount the rider pays. Commission must not be added on top of the rider's price (this is the product promise "price locked at accept"). If the business wants a rider-side service fee, that is a different decision (see 2, option C) and must be shown before the rider accepts.
- **[PROPOSED] Driver-facing invariant:** the driver sees the commission that will apply to a trip *before* sending an offer, and the figure shown is the figure recorded.
- **[PROPOSED]** Negotiation (inDrive-style offers, the 1.5× cap, accept/decline) is unchanged by commission.

## 2. Who bears the commission — [UNDECIDED]

| Option | Description | Consequences |
|---|---|---|
| A. Driver-side | Commission is deducted from what the driver earns; rider pays exactly `locked_price`. | Simplest, keeps the rider promise. Matches the earlier note in `launch/pricing.md` ("one flat commission per completed ride, shown before accepting"). Driver price negotiation must account for it, so the offer screen must show it. |
| B. Platform-side | Platform absorbs it (e.g. promotional period, zero commission). | No driver or rider impact; revenue is zero. Still worth recording a `0` entry so the ledger is complete. |
| C. Rider-side service fee | A separate line added for the rider. | Breaks "pay what you accepted" unless shown before accept; not recommended without a legal/UX review. |
| D. Third party (e.g. partner/merchant for deliveries) | Fee charged to a named party other than rider/driver. | Only if a partner programme exists; needs its own party record. |

**[PROPOSED] default for discussion: option A**, with option B available per period/promotion. **Not approved.**

## 3. How it is calculated — [UNDECIDED]

- **[UNDECIDED]** Model: flat amount per completed ride, a percentage of `locked_price`, a percentage with min/max, or tiered (e.g. by ride kind: ride vs delivery, car vs moto). `launch/pricing.md` leans to "one flat commission per completed ride" but explicitly leaves the number open. **No value is proposed here.**
- **[UNDECIDED]** Whether deliveries (`requests.kind = 'delivery'`) use the same rule as rides.
- **[PROPOSED] mechanics regardless of the model:**
  - The rule is a versioned record (`rule_id`, `version`, model, parameters, `effective_from`, `effective_to`, `created_by`). Rules are never edited, only superseded.
  - The rule version in force is **snapshotted onto the ride at accept time**, so later rule changes never alter commission for rides already accepted, and the figure the driver saw at offer time is the one applied.
  - Amounts are integers in dinars (the same unit as `locked_price`); rounding rule must be fixed in writing (e.g. round half up once, at the final amount).
  - Commission is computed on **completion**, by the server only. No client may send or influence the amount.

## 4. How it is recorded

**[PROPOSED] append-only ledger**, separate from `rides`. Illustrative shape (names are placeholders):

```
commission_rules(id, version, model, params_json, effective_from, effective_to, created_by, created_at)
commission_entries(
  id, ride_id → rides.id, rule_id → commission_rules.id,
  kind        -- 'accrual' | 'reversal' | 'adjustment' | 'waiver'
  amount      -- integer dinars, positive = owed by the driver, negative = credit to the driver
  base_price  -- copy of locked_price used for the calculation (audit trail; not authoritative)
  reason      -- text, required for reversal/adjustment/waiver
  actor       -- 'system' or admin user id
  created_at  -- server time
)
```

- One `accrual` entry per completed ride, enforced unique per `(ride_id, kind='accrual')`.
- Entries are **never updated or deleted** (triggers abort `UPDATE`/`DELETE`, like `lock_price`). Corrections are new entries that point at the same ride.
- A driver's balance is derived: `sum(amount)` over their rides' entries (plus settlements, section 5). It is not a stored, editable number.
- `locked_price` keeps its existing immutability trigger; commission tables get their own.

## 5. Cash rides — [UNDECIDED]

All current rides are paid in **cash, rider → driver, in full (`locked_price`)**; the platform never holds the fare. So commission cannot be taken from the payment. Options (from `launch/pricing.md`, still open):

| Option | How | Open points |
|---|---|---|
| 1. Prepaid driver balance | Driver tops up a balance through a local payment method; each completed ride's accrual is deducted. | Needs a payment/top-up provider (not integrated, not approved). Rule for going online below a minimum balance is **[UNDECIDED]**. |
| 2. Periodic invoice/settlement | Commission accrues; driver settles weekly/monthly. | Collection risk; what happens to unpaid balances (suspension? **[UNDECIDED]**). |
| 3. Hybrid | Small credit allowed, then prepaid. | Credit limit **[UNDECIDED]**. |

- **[PROPOSED]** Settlements are ledger entries too (`kind = 'settlement'`, negative amount) so the balance stays a pure sum.
- **[PROPOSED]** The app must never charge a rider for commission and never ask a rider to pay the platform in cash.
- **[UNDECIDED]** Payment providers, receipts, and whether a tax invoice for the commission is required — **needs a lawyer/accountant** (the existing `bugs.md`/fix plan already flags regulation and says to consult one before launch).

## 6. Auditability

- **[PROPOSED]** Append-only ledger (section 4), server-time stamps, rule version snapshot, base price copy, actor and reason on every non-system entry.
- **[PROPOSED]** Every admin action touching commission (waiver, adjustment, rule change) also writes to the existing `audit` table with admin id, action, target and detail.
- **[PROPOSED]** Reconciliation checks the admin console can run: (a) every `completed` ride has exactly one accrual; (b) no accrual for a ride that is not `completed`; (c) `sum(entries)` equals reported driver balances; (d) `locked_price` unchanged vs `base_price` copy.
- **[PROPOSED]** Entries expose a read-only driver view (per-ride commission in history), as `launch/pricing.md` suggests ("one tap to see the exact commission of every ride").
- **[PROPOSED]** Optional hardening: a hash chain over entries so tampering is detectable. **[UNDECIDED]** whether needed at launch scale.

## 7. Cancelled rides and refunds — [UNDECIDED] unless stated

| Situation | Commission | Notes |
|---|---|---|
| Request cancelled/expired before any offer is accepted | **[PROPOSED] none** | No ride exists. |
| Offer accepted, then cancelled before pickup (rider or driver) | **[PROPOSED] none** (no accrual) | Whether a **separate cancellation fee** exists is **[UNDECIDED]**; if so it is its own entry kind, never part of `locked_price`. |
| Cancelled after arrival/pickup started | **[UNDECIDED]** | Could be none, a fixed fee, or partial; needs a rule. |
| Completed, then a `price_dispute` report is opened | **[PROPOSED]** accrual stays; an admin may add a `reversal`/`waiver` with a reason after review. | Existing `reports` flow and admin console are the review path. |
| Completed ride found fraudulent / driver at fault | **[PROPOSED]** `reversal` entry with reason; original accrual untouched. | |
| Refund of the fare | **Not applicable inside the app today**: the fare is paid in cash outside the platform, so the platform cannot refund it. **[UNDECIDED]** policy if payments are ever added. | `locked_price` is never rewritten by a refund; refunds would be separate records. |
| Refund that reverses commission | **[PROPOSED]** only through a `reversal` entry (negative amount) with reason and actor. | |
| Account deletion | **[UNDECIDED]** The existing `DELETE /api/me` removes a user's rides; the ledger needs a retention rule (accounting/legal) before commission exists. | Flag: current deletion would orphan or remove ledger rows if added naively. |

## 8. Security requirements for the future implementation

- Commission amounts, rules and entries are **server-only**: no client-supplied field is ever read for them.
- Role checks like the rest of the API (`role()` for driver/rider; admin via the dedicated admin session introduced in Phase 2.1). Riders can't read other riders' or drivers' ledgers; drivers can read only their own.
- Negative tests required before release: commission cannot change `locked_price`; client cannot set commission; accrual only on `completed`; double-complete does not double-accrue; replayed requests are idempotent; entries cannot be updated/deleted.

## 9. Decisions needed from the business (checklist)

1. Who bears the commission (section 2)?
2. Calculation model, and the actual figure(s) — *not proposed here* (section 3).
3. Same rule for deliveries?
4. Cash collection model: prepaid, invoice or hybrid; minimum balance / suspension rule (section 5).
5. Cancellation fee: exists or not; amounts (section 7).
6. Dispute/reversal authority: who may waive or reverse, and limits.
7. Retention rule for ledger data vs account deletion.
8. Legal/tax review of the commission and its invoicing (Algeria).
9. Payment/top-up provider (needs separate approval; none is integrated or assumed).
