"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Lock, PenLine, Upload } from "lucide-react";

import {
  updateBranding, updateBusiness, updateEtims, updateMpesa, updateTax,
  type SettingsFormState,
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

/* ------------------------------------------------------ document branding -- */

/**
 * One uploader: the current mark, a file picker, and a way to take it off.
 *
 * The preview is drawn on a chequerboard, because these are almost always
 * transparent PNGs and a white mark on a white card looks like a failed
 * upload. `key` is bumped by the parent after a save so the file input clears
 * rather than continuing to show a filename that has already been consumed.
 */
function MarkUpload({
  name,
  label,
  hint,
  currentUrl,
  previewClass,
}: {
  name: "logo" | "signature";
  label: string;
  hint: string;
  currentUrl: string | null;
  previewClass: string;
}) {
  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-line p-4">
      <p className="text-sm font-medium text-ink">{label}</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-soft">{hint}</p>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div
          className="flex shrink-0 items-center justify-center rounded-lg border border-line bg-[repeating-conic-gradient(var(--color-surface)_0_25%,transparent_0_50%)] bg-[length:12px_12px] p-2"
          style={{ minWidth: "7rem", minHeight: "4.5rem" }}
        >
          {chosen ?? currentUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element --
               the source is a short-lived signed URL or a local object URL;
               next/image would try to cache and re-sign neither. */
            <img
              src={chosen ?? currentUrl!}
              alt={`Current ${label.toLowerCase()}`}
              className={previewClass}
            />
          ) : (
            <span className="px-3 text-xs text-ink-faint">Nothing yet</span>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:border-brand">
            <Upload className="h-4 w-4" />
            {currentUrl ? "Replace" : "Choose file"}
            <input
              type="file"
              name={name}
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setChosen(file ? URL.createObjectURL(file) : null);
              }}
            />
          </label>
          <p className="text-xs text-ink-faint">PNG, JPG or WEBP, up to 2MB.</p>

          {currentUrl && (
            <label className="flex items-center gap-2 text-xs text-ink-soft">
              <input type="checkbox" name={`remove_${name}`} className="h-3.5 w-3.5" />
              Remove it from documents
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

export function BrandingForm({
  logoUrl,
  signatureUrl,
  signatoryName,
  signatoryTitle,
  canEdit,
}: {
  logoUrl: string | null;
  signatureUrl: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(updateBranding, initial);

  if (!canEdit) {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink-soft">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        Only the account owner can change what appears on your documents.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <MarkUpload
        name="logo"
        label="Business logo"
        hint="Printed top-left on every quotation, sales order, invoice and receipt, in place of the default mark."
        currentUrl={logoUrl}
        previewClass="max-h-14 max-w-[10rem] object-contain"
      />

      <MarkUpload
        name="signature"
        label="Authorised signature"
        hint="Printed above the signatory's name at the foot of the document. Crop it tight and use a transparent PNG if you can."
        currentUrl={signatureUrl}
        previewClass="max-h-12 max-w-[10rem] object-contain"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="Signatory name"
          name="signatory_name"
          defaultValue={signatoryName ?? ""}
          placeholder="e.g. Jane Wanjiru"
          hint="Printed under the signature."
        />
        <TextInput
          label="Signatory title"
          name="signatory_title"
          defaultValue={signatoryTitle ?? ""}
          placeholder="e.g. Farm Manager"
        />
      </div>

      <p className="flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 text-xs leading-relaxed text-ink-soft">
        <PenLine className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Your signature is stored privately and is only ever shown to people who
        can already open your documents. Treat it the way you would a stamp:
        anyone who can see an invoice can see the signature on it.
      </p>

      <Feedback state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save branding"}
        </Button>
      </div>
    </form>
  );
}
