"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { formatVndTyping } from "@/lib/money";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "type"> & {
  /** Starting text, such as "300.000". "0" shows the empty box with the 0 placeholder. */
  initialValue?: string;
  onValueChange?: (value: string) => void;
};

/** A VND amount box: 0 is only a placeholder, and dots appear while typing, not after saving. */
export function MoneyInput({ initialValue = "", onValueChange, placeholder = "0", ...rest }: Props) {
  const [value, setValue] = useState(() => formatVndTyping(initialValue === "0" ? "" : initialValue));
  const ref = useRef<HTMLInputElement>(null);
  // Digits left of the caret, so adding a dot does not throw the caret to the end.
  const caretDigits = useRef<number | null>(null);

  useLayoutEffect(() => {
    const input = ref.current;
    if (!input || caretDigits.current === null || document.activeElement !== input) return;
    let seen = 0;
    let pos = 0;
    while (pos < value.length && seen < caretDigits.current) if (/\d/.test(value[pos++])) seen++;
    input.setSelectionRange(pos, pos);
    caretDigits.current = null;
  }, [value]);

  return (
    <input
      {...rest}
      ref={ref}
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={value}
      onChange={(e) => {
        const raw = e.target.value;
        const caret = e.target.selectionStart ?? raw.length;
        const next = formatVndTyping(raw);
        caretDigits.current = /k$/i.test(raw.trim()) ? null : formatVndTyping(raw.slice(0, caret)).replace(/\D/g, "").length;
        setValue(next);
        onValueChange?.(next);
      }}
    />
  );
}
