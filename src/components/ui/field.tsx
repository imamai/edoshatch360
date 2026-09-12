"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

const CONTROL =
  "w-full rounded-lg border border-line-strong bg-surface px-3 text-[0.9375rem] text-ink " +
  "placeholder:text-ink-faint focus:border-brand focus:outline-none " +
  "disabled:bg-surface-sunk disabled:text-ink-faint";

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-critical">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-critical">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({
  label,
  hint,
  error,
  required,
  className,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string | null;
}) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={fieldId} className={className}>
      <input
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL, "h-11", error && "border-critical")}
        {...props}
      />
    </Field>
  );
}

/**
 * Numbers on a farm are typed on a phone, in a poultry house, often one-handed.
 * `inputMode` pulls up the numeric keypad rather than the full QWERTY one
 * (spec §15), and the control is sized for a thumb.
 */
export function NumberInput({
  label,
  hint,
  error,
  required,
  unit,
  className,
  id,
  decimals = false,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  hint?: string;
  error?: string | null;
  unit?: string;
  decimals?: boolean;
}) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={fieldId} className={className}>
      <div className="relative">
        <input
          id={fieldId}
          type="number"
          inputMode={decimals ? "decimal" : "numeric"}
          step={decimals ? "0.01" : "1"}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn(
            CONTROL,
            "h-12 text-lg font-medium tnum",
            unit && "pr-14",
            error && "border-critical",
          )}
          {...props}
        />
        {unit && (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-faint">
            {unit}
          </span>
        )}
      </div>
    </Field>
  );
}

export function SelectInput({
  label,
  hint,
  error,
  required,
  className,
  id,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string | null;
}) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={fieldId} className={className}>
      <select
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL, "h-11 appearance-none bg-no-repeat pr-9", error && "border-critical")}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235a635c' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundPosition: "right 0.75rem center",
        }}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
}

export function TextArea({
  label,
  hint,
  error,
  required,
  className,
  id,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string | null;
}) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={fieldId} className={className}>
      <textarea
        id={fieldId}
        required={required}
        rows={3}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL, "resize-y py-2.5", error && "border-critical")}
        {...props}
      />
    </Field>
  );
}
