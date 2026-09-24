-- Link a stock purchase to the expense it automatically creates.
--
-- recordStockMovement (src/app/app/inventory/actions.ts) inserts a matching
-- expense row whenever a "purchase" movement carries a cost, so the farm's
-- profit figures include what was spent on stock without entering it twice.
-- The two rows were never actually linked — deleting the movement left the
-- expense behind with nothing pointing back to what it was for, and no way
-- for the delete to clean it up after it.
--
-- Nullable and set-null on delete: every existing transaction is unaffected,
-- and an expense deleted on its own from Finance does not take the stock
-- movement down with it — only deleting the movement itself, which is the
-- side that caused the expense to exist, removes both.

alter table public.edoshatch360_inventory_transactions
  add column if not exists expense_id uuid
    references public.edoshatch360_expenses (id) on delete set null;

create index if not exists edoshatch360_invtxn_expense_idx
  on public.edoshatch360_inventory_transactions (expense_id)
  where expense_id is not null;
