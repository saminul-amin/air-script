/**
 * Stroke colour and size for Draw mode, laid out vertically for the tool rail.
 * The first swatch is the paper's ink; the rest are for free drawing.
 */
export const COLORS = [
  { name: "Ink", value: "#1c1f27" },
  { name: "Signal", value: "#ff6a3d" },
  { name: "Sea", value: "#1f6feb" },
  { name: "Moss", value: "#2f9e5f" },
  { name: "Plum", value: "#8b5cf6" },
  { name: "Rose", value: "#e5487a" },
  { name: "Amber", value: "#d69e2e" },
  { name: "Slate", value: "#8a8f9a" },
];

const WIDTHS = [2, 4, 6, 9];

interface ColorPickerProps {
  strokeColor: string;
  lineWidth: number;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
}

export default function ColorPicker({ strokeColor, lineWidth, onColorChange, onWidthChange }: ColorPickerProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-1" aria-label="Stroke colour and size">
      <div className="grid grid-cols-2 gap-1.5">
        {COLORS.map((c, i) => {
          const active = strokeColor === c.value;
          return (
            <button
              key={c.value}
              onClick={() => onColorChange(c.value)}
              title={`${c.name} (${i + 1})`}
              aria-label={c.name}
              aria-pressed={active}
              className={`h-4 w-4 rounded-full transition-ui ${active ? "ring-2 ring-accent ring-offset-2 ring-offset-desk-0" : "hover:scale-110"}`}
              style={{ backgroundColor: c.value, boxShadow: c.value === "#1c1f27" ? "inset 0 0 0 1px var(--line-strong)" : undefined }}
            />
          );
        })}
      </div>
      <div className="my-1 h-px w-6 bg-line" />
      <div className="flex flex-col items-center gap-1">
        {WIDTHS.map((w) => (
          <button
            key={w}
            onClick={() => onWidthChange(w)}
            title={`${w}px`}
            aria-label={`Brush ${w}px`}
            aria-pressed={lineWidth === w}
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-ui ${lineWidth === w ? "bg-desk-2" : "hover:bg-desk-2/60"}`}
          >
            <span className="rounded-full bg-text-1" style={{ width: w + 2, height: w + 2 }} />
          </button>
        ))}
      </div>
    </div>
  );
}
