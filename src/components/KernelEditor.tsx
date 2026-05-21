import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { KERNEL_PRESETS, findPresetByKernel } from '@/transforms/kernels';
import type { Kernel3x3 } from '@/transforms/convolution';

type Props = {
  kernel: Kernel3x3;
  onChange: (k: Kernel3x3) => void;
  className?: string;
};

/**
 * Preset dropdown + 3×3 grid of editable coefficients. Picking a preset
 * fills the grid; hand-editing any cell flips the dropdown to "Произвольное"
 * (no preset matches the current coefficients).
 */
export function KernelEditor({ kernel, onChange, className }: Props) {
  const matched = findPresetByKernel(kernel);
  const selectedId = matched?.id ?? 'custom';

  const handlePresetChange = (id: string) => {
    if (id === 'custom') return;
    const preset = KERNEL_PRESETS.find((p) => p.id === id);
    if (preset) onChange(preset.kernel);
  };

  const handleCellChange = (idx: number, value: number) => {
    const next = Array.from(kernel) as number[];
    next[idx] = value;
    onChange(next as unknown as Kernel3x3);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <label className="w-16 text-sm" htmlFor="kernel-preset">
          Пресет
        </label>
        <select
          id="kernel-preset"
          className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={selectedId}
          onChange={(e) => handlePresetChange(e.target.value)}
        >
          <option value="custom">Произвольное</option>
          {KERNEL_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {matched && (
        <p className="px-1 text-xs leading-relaxed text-muted-foreground">
          {matched.description}
        </p>
      )}

      <div className="grid grid-cols-3 gap-1.5">
        {Array.from(kernel).map((value, idx) => (
          <KernelCell
            key={idx}
            value={value}
            onChange={(next) => handleCellChange(idx, next)}
          />
        ))}
      </div>
    </div>
  );
}

function KernelCell({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const [text, setText] = useState<string>(() => formatCellValue(value));
  const textRef = useRef(text);
  textRef.current = text;

  // Re-sync from prop only when the parsed text would actually differ from
  // the new value. This lets the user mid-type "0." or "-" without it being
  // clobbered to "0" after the parent re-renders with the same number from
  // our own onChange feedback.
  useEffect(() => {
    const parsed = parseFloat(textRef.current);
    if (!Number.isFinite(parsed) || Math.abs(parsed - value) > 1e-9) {
      setText(formatCellValue(value));
    }
  }, [value]);

  return (
    <input
      type="number"
      step="0.01"
      value={text}
      onChange={(e) => {
        const str = e.target.value;
        setText(str);
        const parsed = parseFloat(str);
        if (Number.isFinite(parsed)) onChange(parsed);
      }}
      className={cn(
        'h-9 w-full rounded-md border border-input bg-background px-1.5 text-center text-sm tabular-nums',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        // Hide the browser's number-spinner buttons — they're too tall for
        // a 3×3 grid and the +/- doesn't fit the editing flow anyway.
        '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
      )}
    />
  );
}

/**
 * Round to 4 decimals and drop trailing zeros so 1/16 shows as 0.0625 and
 * integers stay integers. Box-blur's 0.1111 loses precision slightly, but
 * the editor isn't a persistence layer — Apply uses whatever the user sees.
 */
function formatCellValue(n: number): string {
  return (+n.toFixed(4)).toString();
}
