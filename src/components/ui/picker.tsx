"use client";

import { useId, useState } from "react";
import { Field } from "./field";
import { cn } from "@/lib/utils";
import { OTHER } from "@/lib/catalogues";

const CONTROL =
  "w-full rounded-lg border border-line-strong bg-surface px-3 text-[0.9375rem] text-ink " +
  "placeholder:text-ink-faint focus:border-brand focus:outline-none";

/**
 * A dropdown that still allows an answer nobody thought of.
 *
 * Choosing "Something else" reveals a text box; the chosen value is submitted
 * under a single form field either way, so server actions stay unaware of the
 * distinction. Free typing is the fallback, not the default — that is what
 * keeps a stock list from filling up with three spellings of "layers mash".
 */
export function Picker({
  label,
  name,
  groups,
  hint,
  error,
  required,
  defaultValue = "",
  placeholder = "Select…",
  otherLabel = "Something else — let me type it",
  otherPlaceholder = "Type the name",
  className,
  onValueChange,
}: {
  label: string;
  name: string;
  groups: { group: string; items: string[] }[];
  hint?: string;
  error?: string | null;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  otherLabel?: string;
  otherPlaceholder?: string;
  className?: string;
  onValueChange?: (value: string) => void;
}) {
  const known = groups.some((g) => g.items.includes(defaultValue));
  const [choice, setChoice] = useState(
    defaultValue === "" ? "" : known ? defaultValue : OTHER,
  );
  const [custom, setCustom] = useState(known ? "" : defaultValue);
  const id = useId();

  const value = choice === OTHER ? custom : choice;

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={id}
      className={className}
    >
      {/* The real submitted value, so the server sees one field. */}
      <input type="hidden" name={name} value={value} />

      <select
        id={id}
        value={choice}
        onChange={(e) => {
          setChoice(e.target.value);
          onValueChange?.(e.target.value === OTHER ? custom : e.target.value);
        }}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL, "h-11 appearance-none bg-no-repeat pr-9", error && "border-critical")}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235a635c' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundPosition: "right 0.75rem center",
        }}
      >
        <option value="">{placeholder}</option>
        {groups.map((group) => (
          <optgroup key={group.group} label={group.group}>
            {group.items.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </optgroup>
        ))}
        <option value={OTHER}>{otherLabel}</option>
      </select>

      {choice === OTHER && (
        <input
          type="text"
          value={custom}
          autoFocus
          required={required}
          onChange={(e) => {
            setCustom(e.target.value);
            onValueChange?.(e.target.value);
          }}
          placeholder={otherPlaceholder}
          className={cn(CONTROL, "mt-2 h-11")}
        />
      )}
    </Field>
  );
}

/** The same pattern for a flat list with no groups. */
export function SimplePicker(
  props: Omit<React.ComponentProps<typeof Picker>, "groups"> & { options: string[] },
) {
  const { options, ...rest } = props;
  return <Picker {...rest} groups={[{ group: "", items: options }]} />;
}
