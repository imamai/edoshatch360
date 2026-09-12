"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Lock } from "lucide-react";

import {
  updateBusiness, updateEtims, updateMpesa, updateTax, type SettingsFormState,
} from "./actions";
import { Button } from "@/components/ui/button";
import { SelectInput, TextArea, TextInput } from "@/components/ui/field";
import type { FarmMode, Tenant } from "@/lib/database.types";
import { cn } from "@/lib/utils";

const initial: SettingsFormState = { error: null, ok: null };

function Feedback({ state }: { state: SettingsFormState }) {
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

function Toggle({
  name,
  label,
  hint,
  defaultChecked,
  disabled,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-relaxed text-ink-faint">{hint}</span>}
      </span>
    </label>
  );
}

/** Shown in place of a form when the plan does not include the feature. */
export function PlanLocked({ feature, plan }: { feature: string; plan: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-line bg-surface-sunk p-4">
      <Lock className="mt-0.5 h-4.5 w-4.5 shrink-0 text-ink-faint" />
      <div>
        <p className="text-sm font-medium text-ink">{feature} is not on your plan</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
          You are on <strong className="text-ink">{plan}</strong>. Upgrade to turn this on —
          your existing records are untouched either way.
        </p>
      </div>
    </div>
  );
}

export function BusinessForm({ tenant }: { tenant: Tenant }) {
  const [state, action, pending] = useActionState(updateBusiness, initial);
  const [mode, setMode] = useState<FarmMode>(tenant.mode);

  return (
    <form action={action} className="flex flex-col gap-4">
      <TextInput
        label="Business name"
        name="name"
        required
        defaultValue={tenant.name}
        hint="Appears at the top of every invoice and receipt."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Phone" name="phone" type="tel" defaultValue={tenant.phone ?? ""} />
        <TextInput label="Email" name="email" type="email" defaultValue={tenant.email ?? ""} />
      </div>

      <TextArea
        label="Address"
        name="address"
        rows={2}
        defaultValue={tenant.address ?? ""}
        placeholder="Postal or physical address for your documents"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="KRA PIN"
          name="kra_pin"
          defaultValue={tenant.kra_pin ?? ""}
          placeholder="A123456789Z"
          hint="Printed on tax invoices. Leave blank if not registered."
        />
        <SelectInput label="Currency" name="currency" defaultValue={tenant.currency}>
          <option value="KES">KES — Kenyan shilling</option>
          <option value="UGX">UGX — Ugandan shilling</option>
          <option value="TZS">TZS — Tanzanian shilling</option>
          <option value="USD">USD — US dollar</option>
        </SelectInput>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">How much should the app show?</legend>
        <input type="hidden" name="mode" value={mode} />
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["simple", "Simple", "Birds, eggs, feed, sales, expenses, profit."],
              ["advanced", "Advanced", "Adds inventory, customers, reports and analytics."],
            ] as const
          ).map(([value, title, note]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              aria-pressed={mode === value}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                mode === value
                  ? "border-brand bg-brand-tint ring-1 ring-brand/20"
                  : "border-line hover:border-line-strong",
              )}
            >
              <span className="block text-sm font-semibold text-ink">{title}</span>
              <span className="mt-0.5 block text-xs leading-snug text-ink-faint">{note}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-faint">
          Switching to Simple hides the advanced screens; it never deletes anything.
        </p>
      </fieldset>

      <Feedback state={state} />

      <Button type="submit" busy={pending} className="self-start">
        {pending ? "Saving" : "Save business details"}
      </Button>
    </form>
  );
}

export function TaxForm({ value }: { value: Record<string, unknown> }) {
  const [state, action, pending] = useActionState(updateTax, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Toggle
        name="vat_registered"
        label="This business is VAT registered"
        hint="Turns on VAT lines on your invoices."
        defaultChecked={Boolean(value.vat_registered)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="VAT rate"
          name="vat_rate"
          type="number"
          step="0.01"
          min={0}
          max={100}
          defaultValue={String(value.vat_rate ?? 16)}
          hint="Kenya standard rate is 16%."
        />
        <div className="flex items-end">
          <Toggle
            name="prices_include_vat"
            label="My prices already include VAT"
            defaultChecked={Boolean(value.prices_include_vat)}
          />
        </div>
      </div>

      <TextArea
        label="Invoice footer"
        name="invoice_footer"
        rows={2}
        defaultValue={String(value.invoice_footer ?? "")}
        placeholder="Bank details, payment terms, or a thank-you line."
      />

      <Feedback state={state} />

      <Button type="submit" busy={pending} className="self-start">
        {pending ? "Saving" : "Save tax settings"}
      </Button>
    </form>
  );
}

export function EtimsForm({
  value,
  locked,
  plan,
}: {
  value: Record<string, unknown>;
  locked: boolean;
  plan: string;
}) {
  const [state, action, pending] = useActionState(updateEtims, initial);

  if (locked) return <PlanLocked feature="eTIMS integration" plan={plan} />;

  return (
    <form action={action} className="flex flex-col gap-4">
      <Toggle
        name="etims_enabled"
        label="Send invoices to KRA eTIMS"
        hint="Your tax invoices carry an eTIMS control number once this is set up and verified."
        defaultChecked={Boolean(value.enabled)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="eTIMS PIN"
          name="etims_pin"
          defaultValue={String(value.pin ?? "")}
          placeholder="A123456789Z"
        />
        <TextInput
          label="Branch ID"
          name="etims_branch"
          defaultValue={String(value.branch_id ?? "")}
          placeholder="00"
          hint="Issued by KRA. Head office is usually 00."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="Device serial"
          name="etims_device"
          defaultValue={String(value.device_serial ?? "")}
          placeholder="From your eTIMS registration"
        />
        <SelectInput
          label="Environment"
          name="etims_env"
          defaultValue={String(value.environment ?? "sandbox")}
        >
          <option value="sandbox">Sandbox — for testing</option>
          <option value="production">Production — live invoices</option>
        </SelectInput>
      </div>

      <Feedback state={state} />

      <Button type="submit" busy={pending} className="self-start">
        {pending ? "Saving" : "Save eTIMS settings"}
      </Button>

      <p className="text-xs leading-relaxed text-ink-faint">
        Storing these details prepares your account. Live transmission to KRA is switched
        on per-account once your details are verified — until then invoices print
        normally without a control number.
      </p>
    </form>
  );
}

export function MpesaForm({
  value,
  locked,
  plan,
}: {
  value: Record<string, unknown>;
  locked: boolean;
  plan: string;
}) {
  const [state, action, pending] = useActionState(updateMpesa, initial);

  if (locked) return <PlanLocked feature="M-Pesa collection" plan={plan} />;

  return (
    <form action={action} className="flex flex-col gap-4">
      <Toggle
        name="mpesa_enabled"
        label="Show my M-Pesa details on invoices"
        hint="So customers know exactly where to send money."
        defaultChecked={Boolean(value.enabled)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="Paybill number"
          name="mpesa_paybill"
          defaultValue={String(value.paybill ?? "")}
          placeholder="e.g. 123456"
        />
        <TextInput
          label="Till number"
          name="mpesa_till"
          defaultValue={String(value.till ?? "")}
          placeholder="e.g. 987654"
        />
      </div>

      <TextInput
        label="Account name"
        name="mpesa_account"
        defaultValue={String(value.account_name ?? "")}
        placeholder="What customers should put as the account"
      />

      <Feedback state={state} />

      <Button type="submit" busy={pending} className="self-start">
        {pending ? "Saving" : "Save M-Pesa details"}
      </Button>

      <p className="text-xs leading-relaxed text-ink-faint">
        These are your public collection details only. Hatch360 never asks for or stores
        your M-Pesa PIN, API secret or any other credential.
      </p>
    </form>
  );
}
