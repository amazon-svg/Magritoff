import { useEffect, useState } from 'react';
import { millimetersToPoints, pointsToMillimeters } from './pdf-coordinates';

type Props = Readonly<{
  id: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  testId?: string;
  onChange(points: number): void;
}>;

/** Les longueurs restent en points dans le contrat PDF ; la saisie se fait en mm. */
export function MillimeterInput({ id, label, value, min = 0, max = 20000, testId, onChange }: Props) {
  const displayedValue = String(Number(pointsToMillimeters(value).toFixed(2)));
  const [draft, setDraft] = useState(displayedValue);
  useEffect(() => setDraft(displayedValue), [displayedValue]);

  function commit(): void {
    const points = millimetersToPoints(Number(draft));
    // Tolérance limitée à l’arrondi des bornes affichées au centième de mm.
    if (draft.trim() === '' || !Number.isFinite(points) || points < min - 0.015 || points > max + 0.015) {
      setDraft(displayedValue);
      return;
    }
    // Une simple prise de focus ne doit pas arrondir la coordonnée existante.
    if (draft !== displayedValue) onChange(Math.max(min, Math.min(max, points)));
  }

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs text-ink-2">{label} (mm)</label>
      <input
        id={id}
        type="number"
        step="0.01"
        min={pointsToMillimeters(min).toFixed(2)}
        max={pointsToMillimeters(max).toFixed(2)}
        value={draft}
        data-testid={testId}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        className="w-full min-w-0 px-2 py-1.5 border border-line-2 rounded-lg bg-paper text-sm"
      />
    </div>
  );
}
