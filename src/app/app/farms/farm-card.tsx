"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, Pencil, RotateCcw, Trash2, TriangleAlert, X } from "lucide-react";

import {
  deleteFarm, deleteHouse, setHouseActive, updateFarm, updateHouse, type FarmFormState,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, type Tone } from "@/components/ui/badge";
import { NumberInput, TextInput } from "@/components/ui/field";
import { formatNumber } from "@/lib/utils";
import type { Farm, FarmHealth, Flock, House } from "@/lib/database.types";

const initial: FarmFormState = { error: null, ok: null };

function Feedback({ state }: { state: FarmFormState }) {
  if (state.error) {
    return (
      <p role="alert" className="mt-2 rounded-lg border border-critical/25 bg-critical-soft px-3 py-2 text-xs text-critical">
        {state.error}
      </p>
    );
  }
  if (state.ok) return <p className="mt-2 text-xs text-good">{state.ok}</p>;
  return null;
}

const BAND_TONE: Record<FarmHealth["band"], Tone> = {
  excellent: "good",
  good: "brand",
  attention: "attention",
  critical: "critical",
  unknown: "neutral",
};

export function FarmCard({
  farm,
  houses,
  flocks,
  health,
  canManage,
}: {
  farm: Farm;
  houses: House[];
  flocks: Flock[];
  health: FarmHealth | null;
  canManage: boolean;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const birds = flocks.reduce((a, f) => a + f.current_count, 0);

  return (
    <Card>
      <CardHeader
        title={farm.name}
        subtitle={[farm.location, farm.county].filter(Boolean).join(" · ") || "No location set"}
        icon={<MapPin className="h-4 w-4" />}
        action={
          <div className="flex items-center gap-2">
            {health && (
              <Badge tone={BAND_TONE[health.band]} dot>
                {health.score !== null ? `${health.score} / 100` : "No score yet"}
              </Badge>
            )}
            {canManage && mode === "view" && (
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setMode("edit")}
                  aria-label={`Edit ${farm.name}`}
                  className="rounded-md p-1.5 text-ink-faint hover:bg-surface-sunk hover:text-brand"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setMode("delete")}
                  aria-label={`Delete ${farm.name}`}
                  className="rounded-md p-1.5 text-ink-faint hover:bg-surface-sunk hover:text-critical"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        }
      />
      <CardBody className="p-0">
        {mode === "edit" && (
          <div className="border-b border-line px-4 py-4 sm:px-5">
            <FarmEditForm farm={farm} onDone={() => setMode("view")} />
          </div>
        )}
        {mode === "delete" && (
          <div className="border-b border-line bg-critical-soft px-4 py-3 sm:px-5">
            <FarmDeleteConfirm farm={farm} houseCount={houses.length} flockCount={flocks.length} onCancel={() => setMode("view")} />
          </div>
        )}

        <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
          {[
            ["Houses", houses.length],
            ["Flocks", flocks.length],
            ["Birds", formatNumber(birds)],
          ].map(([label, value]) => (
            <div key={String(label)} className="px-4 py-3 text-center">
              <p className="text-lg font-semibold text-ink tnum">{value}</p>
              <p className="text-xs text-ink-faint">{label}</p>
            </div>
          ))}
        </div>

        {houses.length === 0 ? (
          <p className="px-5 py-5 text-center text-sm text-ink-faint">
            No houses recorded on this farm yet. Add one alongside to organise your flocks by shed.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {houses.map((house) => (
              <HouseRow
                key={house.id}
                house={house}
                inHouse={flocks.filter((f) => f.house_id === house.id)}
                canManage={canManage}
              />
            ))}
          </ul>
        )}

        {flocks.length > 0 && (
          <div className="border-t border-line px-4 py-3 sm:px-5">
            <p className="mb-2 text-xs font-semibold text-ink-faint">Flocks here</p>
            <div className="flex flex-wrap gap-1.5">
              {flocks.map((f) => (
                <Link
                  key={f.id}
                  href={`/app/flocks/${f.id}`}
                  className="rounded-full border border-line-strong px-2.5 py-1 text-xs font-medium text-ink-soft hover:border-brand hover:text-brand"
                >
                  {f.code}
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function FarmEditForm({ farm, onDone }: { farm: Farm; onDone: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateFarm, initial);

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    const t = setTimeout(onDone, 350);
    return () => clearTimeout(t);
  }, [state.ok, router, onDone]);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={farm.id} />
      <TextInput label="Name" name="name" required defaultValue={farm.name} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label="Location" name="location" defaultValue={farm.location ?? ""} hint="Optional" />
        <TextInput label="County" name="county" defaultValue={farm.county ?? ""} hint="Optional" />
      </div>
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

function FarmDeleteConfirm({
  farm,
  houseCount,
  flockCount,
  onCancel,
}: {
  farm: Farm;
  houseCount: number;
  flockCount: number;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    start(async () => {
      const result = await deleteFarm(farm.id);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex gap-2.5">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-critical" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-critical">Delete {farm.name} permanently?</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
          {houseCount > 0 || flockCount > 0 ? (
            <>
              This farm has {flockCount} flock{flockCount === 1 ? "" : "s"} and {houseCount} house
              {houseCount === 1 ? "" : "s"} on it — deleting it takes all of that with it, including
              every daily record and vaccination those flocks have. Move or close them first.
            </>
          ) : (
            <>It has nothing built on it yet, so nothing else is affected.</>
          )}
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
  );
}

function HouseRow({
  house,
  inHouse,
  canManage,
}: {
  house: House;
  inHouse: Flock[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [pending, start] = useTransition();
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const housed = inHouse.reduce((a, f) => a + f.current_count, 0);
  const full = house.capacity && house.capacity > 0 ? housed / house.capacity : null;

  function toggleActive() {
    start(async () => {
      const result = await setHouseActive(house.id, !house.is_active);
      if (result.error) setArchiveError(result.error);
      else {
        setArchiveError(null);
        router.refresh();
      }
    });
  }

  return (
    <li className="px-4 py-3 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <span>
              {house.name}
              {house.code ? ` · ${house.code}` : ""}
            </span>
            {!house.is_active && <Badge tone="neutral">Archived</Badge>}
          </p>
          <p className="text-xs text-ink-faint">
            {inHouse.length > 0 ? inHouse.map((f) => f.code).join(", ") : "Empty"}
            {house.house_type ? ` · ${house.house_type.replace(/_/g, " ")}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right">
            <p className="text-sm font-semibold text-ink tnum">
              {formatNumber(housed)}
              {house.capacity ? (
                <span className="font-normal text-ink-faint"> / {formatNumber(house.capacity)}</span>
              ) : null}
            </p>
            {full !== null && (
              <p className={`text-xs tnum ${full > 1 ? "text-critical" : "text-ink-faint"}`}>
                {Math.round(full * 100)}% full
              </p>
            )}
          </div>
          {canManage && mode === "view" && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setMode("edit")}
                aria-label={`Edit ${house.name}`}
                className="rounded-md p-1.5 text-ink-faint hover:bg-surface-sunk hover:text-brand"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={toggleActive}
                aria-label={house.is_active ? `Archive ${house.name}` : `Restore ${house.name}`}
                title={house.is_active ? "Take off the active list" : "Put back on the active list"}
                className="rounded-md p-1.5 text-ink-faint hover:bg-surface-sunk hover:text-attention"
              >
                {house.is_active ? <X className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setMode("delete")}
                aria-label={`Delete ${house.name}`}
                className="rounded-md p-1.5 text-ink-faint hover:bg-surface-sunk hover:text-critical"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
      {archiveError && <p className="mt-1 text-xs text-critical">{archiveError}</p>}

      {mode === "edit" && (
        <div className="mt-3 rounded-lg border border-line bg-surface-sunk p-3">
          <HouseEditForm house={house} onDone={() => setMode("view")} />
        </div>
      )}
      {mode === "delete" && (
        <div className="mt-3 rounded-lg border border-critical/25 bg-critical-soft p-3">
          <HouseDeleteConfirm house={house} housedFlocks={inHouse.length} onCancel={() => setMode("view")} />
        </div>
      )}
    </li>
  );
}

function HouseEditForm({ house, onDone }: { house: House; onDone: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateHouse, initial);

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    const t = setTimeout(onDone, 350);
    return () => clearTimeout(t);
  }, [state.ok, router, onDone]);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={house.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label="Name" name="name" required defaultValue={house.name} />
        <TextInput label="Code" name="code" defaultValue={house.code ?? ""} hint="Optional" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberInput label="Capacity" name="capacity" min={0} defaultValue={house.capacity ?? ""} hint="Birds" />
        <TextInput label="Type" name="house_type" defaultValue={house.house_type ?? ""} hint="Optional" />
      </div>
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

function HouseDeleteConfirm({
  house,
  housedFlocks,
  onCancel,
}: {
  house: House;
  housedFlocks: number;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    start(async () => {
      const result = await deleteHouse(house.id);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex gap-2.5">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-critical" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-critical">Delete {house.name}?</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
          {housedFlocks > 0
            ? `${housedFlocks} flock${housedFlocks === 1 ? "" : "s"} currently show this house — they simply show no house afterwards, nothing else is lost.`
            : "Nothing is currently housed here."}
        </p>
        {error && (
          <p role="alert" className="mt-2 text-xs text-critical">
            {error}
          </p>
        )}
        <div className="mt-2.5 flex gap-2">
          <Button variant="danger" size="sm" busy={pending} onClick={remove}>
            Delete
          </Button>
          <button type="button" onClick={onCancel} className="text-sm font-semibold text-ink-faint hover:text-ink">
            Keep it
          </button>
        </div>
      </div>
    </div>
  );
}
