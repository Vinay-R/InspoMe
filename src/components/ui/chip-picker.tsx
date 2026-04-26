"use client";

import * as React from "react";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

type ChipOption = string | { value: string; label: string };

function asOption(o: ChipOption): { value: string; label: string } {
  return typeof o === "string" ? { value: o, label: o } : o;
}

export interface ChipPickerProps {
  options: readonly ChipOption[];
  values: string[];
  onChange: (next: string[]) => void;
  /** Multi-select if true; single-select if false. */
  multi?: boolean;
  /** Cap selection count (multi only). */
  max?: number;
  /** Allow free-text "Other" entries. */
  allowCustom?: boolean;
  /** Disable interaction. */
  disabled?: boolean;
  className?: string;
}

export function ChipPicker({
  options,
  values,
  onChange,
  multi = true,
  max,
  allowCustom = true,
  disabled,
  className,
}: ChipPickerProps) {
  const [customDraft, setCustomDraft] = React.useState("");
  const [showCustomInput, setShowCustomInput] = React.useState(false);

  const knownValues = React.useMemo(
    () => new Set(options.map((o) => asOption(o).value)),
    [options],
  );
  const customValues = values.filter((v) => !knownValues.has(v));

  const isSelected = (v: string) => values.includes(v);

  const select = (v: string) => {
    if (disabled) return;
    if (!multi) {
      onChange(isSelected(v) ? [] : [v]);
      return;
    }
    if (isSelected(v)) {
      onChange(values.filter((x) => x !== v));
      return;
    }
    if (max !== undefined && values.length >= max) {
      return;
    }
    onChange([...values, v]);
  };

  const removeCustom = (v: string) => {
    if (disabled) return;
    onChange(values.filter((x) => x !== v));
  };

  const addCustom = () => {
    const trimmed = customDraft.trim();
    if (!trimmed) return;
    if (max !== undefined && multi && values.length >= max) return;
    if (!values.includes(trimmed)) {
      onChange(multi ? [...values, trimmed] : [trimmed]);
    }
    setCustomDraft("");
    setShowCustomInput(false);
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const opt = asOption(o);
          const selected = isSelected(opt.value);
          const atCap =
            !selected && multi && max !== undefined && values.length >= max;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => select(opt.value)}
              disabled={disabled || atCap}
              className={cn(
                "group inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                selected
                  ? "border-brand bg-brand text-brand-foreground shadow-xs"
                  : "border-border bg-background text-foreground hover:border-foreground/40 hover:bg-accent",
                atCap && "opacity-40",
                disabled && "cursor-not-allowed opacity-50",
              )}
              aria-pressed={selected}
            >
              {selected ? <Check className="size-3.5" /> : null}
              {opt.label}
            </button>
          );
        })}

        {customValues.map((v) => (
          <span
            key={v}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-brand bg-brand text-brand-foreground px-3.5 py-2 text-sm font-medium shadow-xs"
          >
            <Check className="size-3.5" />
            {v}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeCustom(v)}
                aria-label={`Remove ${v}`}
                className="ml-1 -mr-1 rounded-full p-0.5 hover:bg-brand-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-foreground/40"
              >
                <X className="size-3.5" />
              </button>
            )}
          </span>
        ))}

        {allowCustom && !showCustomInput && (
          <button
            type="button"
            onClick={() => setShowCustomInput(true)}
            disabled={
              disabled ||
              (multi && max !== undefined && values.length >= max)
            }
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-border px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors",
              "hover:border-foreground/40 hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            <Plus className="size-3.5" />
            Other
          </button>
        )}
      </div>

      {showCustomInput && (
        <div className="flex items-center gap-2">
          <Input
            value={customDraft}
            onChange={(e) => setCustomDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
              if (e.key === "Escape") {
                setShowCustomInput(false);
                setCustomDraft("");
              }
            }}
            placeholder="Type your own"
            autoFocus
            maxLength={60}
            className="flex-1"
          />
          <button
            type="button"
            onClick={addCustom}
            className="inline-flex min-h-11 items-center rounded-md bg-foreground px-3 text-sm font-medium text-background hover:bg-foreground/90"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCustomInput(false);
              setCustomDraft("");
            }}
            className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}

      {multi && max !== undefined && (
        <p className="text-xs text-muted-foreground">
          {values.length} of {max} selected
        </p>
      )}
    </div>
  );
}
