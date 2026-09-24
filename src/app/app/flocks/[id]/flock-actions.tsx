"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lock, Pencil, Trash2, TriangleAlert } from "lucide-react";

import {
  deleteFlock, setFlockStatus, updateFlock, type FlockFormState,
} from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { NumberInput, SelectInput, TextArea, TextInput } from "@/components/ui/field";
import { today } from "@/lib/utils";
import type { Flock, House } from "@/lib/database.types";

const initial: FlockFormState = { error: null, ok: null };

const FLOCK_STATUS_LABEL: Record<Flock["status"], string> = {
  planned: "Planned",
  brooding: "Brooding",
  growing: "Growing",
  laying: "Laying",
  finishing: "Finishing",
  harvested: "Harvested",
  closed: "Closed",
};

function Feedback({ state }: { state: FlockFormState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg border border-critical/25 bg-critical-soft px-3 py-2 text-sm text-critical">
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-good/25 bg-good-soft px-3 py-2 text-sm text-good">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        {state.ok}
      </p>
    );
  }
  return null;
}

export function FlockActions({
  flock,
  houses,
  canManage,
}: {
  flock: Flock;
  houses: House[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<"edit" | "close" | "delete" | null>(null);
  const [pending, start] = useTransition();
  const [closeError, setCloseError] = useState<string | null>(null);

  if (!canManage) return null;

  const closed = flock.status === "closed" || flock.status === "harvested";

  function reopen() {
    start(async () => {
      const result = await setFlockStatus(flock.id, "growing");
      if (result.error) setCloseError(result.error);
      else {
        setCloseError(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => setPanel(panel === "edit" ? null : "edit")}>
          <Pencil className="h-4 w-4" />
          Edit flock
        </Button>
        {closed ? (
          <Button variant="secondary" size="sm" busy={pending} onClick={reopen}>
            Reopen
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setPanel(panel === "close" ? null : "close")}>
            <Lock className="h-4 w-4" />
            Close flock
          </Button>
        )}
        <Button variant="danger" size="sm" onClick={() => setPanel(panel === "delete" ? null : "delete")}>
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>
      {closeError && <p className="text-xs text-critical">{closeError}</p>}

      {panel === "edit" && (
        <Card>
          <CardBody>
            <EditForm flock={flock} houses={houses} onDone={() => setPanel(null)} />
          </CardBody>
        </Card>
      )}
      {panel === "close" && (
        <Card>
          <CardBody>
            <CloseForm flock={flock} onDone={() => setPanel(null)} />
          </CardBody>
        </Card>
      )}
      {panel === "delete" && <DeleteConfirm flock={flock} onCancel={() => setPanel(null)} />}
    </div>
  );
}

function EditForm({
  flock,
  houses,
  onDone,
}: {
  flock: Flock;
  houses: House[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateFlock, initial);

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    const t = setTimeout(onDone, 350);
    return () => clearTimeout(t);
  }, [state.ok, router, onDone]);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={flock.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label="Name" name="name" defaultValue={flock.name ?? ""} hint="Optional" />
        <TextInput label="Breed" name="breed" defaultValue={flock.breed ?? ""} hint="Optional" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput
          label="Placement date"
          name="placement_date"
          type="date"
          defaultValue={flock.placement_date}
          max={today()}
        />
        <NumberInput
          label="Birds placed"
          name="placement_count"
          min={1}
          required
          defaultValue={flock.placement_count}
          hint="The live count recalculates from this and every loss recorded since."
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectInput label="House" name="house_id" defaultValue={flock.house_id ?? ""}>
          <option value="">Not assigned</option>
          {houses.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
              {h.code ? ` · ${h.code}` : ""}
            </option>
          ))}
        </SelectInput>
        <NumberInput
          label="Cost per bird"
          name="cost_per_bird"
          unit="KES"
          decimals
          min={0}
          defaultValue={flock.cost_per_bird_cents / 100}
        />
      </div>

      <TextInput label="Source hatchery" name="source_hatchery" defaultValue={flock.source_hatchery ?? ""} hint="Optional" />
      <TextArea label="Notes" name="notes" rows={2} defaultValue={flock.notes ?? ""} />

      <Feedback state={state} />

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" busy={pending}>
          {pending ? "Saving" : "Save changes"}
        </Button>
        <button type="button" onClick={onDone} className="text-sm font-semibold text-ink-faint hover:text-ink">
          Cancel
        </button>
      </div>
    </form>
  );
}

function CloseForm({ flock, onDone }: { flock: Flock; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"harvested" | "closed">("harvested");

  function submit() {
    start(async () => {
      const result = await setFlockStatus(flock.id, status);
      if (result.error) setError(result.error);
      else {
        setError(null);
        router.refresh();
        onDone();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-soft">
        {FLOCK_STATUS_LABEL[flock.status]} → close this batch out. It stays on record and every
        figure it has already contributed is untouched — it simply stops being counted as active.
      </p>
      <SelectInput label="Closing as" value={status} onChange={(e) => setStatus(e.target.value as "harvested" | "closed")}>
        <option value="harvested">Harvested — birds sold or processed</option>
        <option value="closed">Closed — ended some other way</option>
      </SelectInput>
      {error && (
        <p role="alert" className="rounded-lg border border-critical/25 bg-critical-soft px-3 py-2 text-sm text-critical">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button size="sm" busy={pending} onClick={submit}>
          Close flock
        </Button>
        <button type="button" onClick={onDone} className="text-sm font-semibold text-ink-faint hover:text-ink">
          Cancel
        </button>
      </div>
    </div>
  );
}

function DeleteConfirm({ flock, onCancel }: { flock: Flock; onCancel: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    start(async () => {
      const result = await deleteFlock(flock.id);
      if (result.error) setError(result.error);
      else router.push("/app/flocks");
    });
  }

  return (
    <Card>
      <CardBody>
        <div className="flex gap-2.5">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-critical" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-critical">Delete {flock.code} permanently?</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
              Only possible while nothing has been recorded against it yet — any daily entry,
              vaccination, health record or medication blocks this and closing is offered instead.
            </p>
            {error && (
              <p role="alert" className="mt-2 text-xs text-critical">
                {error}
              </p>
            )}
            <div className="mt-2.5 flex gap-2">
              <Button variant="danger" size="sm" busy={pending} onClick={remove}>
                Delete for good
              </Button>
              <button type="button" onClick={onCancel} className="text-sm font-semibold text-ink-faint hover:text-ink">
                Keep it
              </button>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
