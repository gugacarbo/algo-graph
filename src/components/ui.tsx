import type { ReactNode, SelectHTMLAttributes } from "react";
import { IconChevronDown } from "./icons";

export function FieldRow({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-2.5">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="panel-title" style={{ fontSize: 10 }}>
          {label}
        </span>
        {hint && (
          <span className="font-mono2 text-[10px]" style={{ color: "var(--faint)" }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={`field ${props.className ?? ""}`} />
      <span
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
        style={{ color: "var(--faint)" }}
      >
        <IconChevronDown size={12} />
      </span>
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 mt-4 flex items-center justify-between first:mt-0">
      <div className="panel-title">{children}</div>
      {right}
    </div>
  );
}

export function Dot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 flex-none rounded-full ${pulse ? "pulse-dot" : ""}`}
      style={{ background: color, boxShadow: `0 0 6px ${color}` }}
    />
  );
}

/** Slider with an amber fill track. */
export function Range({
  value,
  min,
  max,
  step,
  onChange,
  disabled,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      className="rng"
      style={{ ["--fill" as string]: `${fill}%` }}
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(parseFloat(e.target.value))}
    />
  );
}
