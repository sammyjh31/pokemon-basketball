export const draftImpactChangeLabel = (value: number | null) =>
  value === null
    ? "First pick"
    : value > 0
      ? `+${value.toFixed(1)}`
      : value < 0
        ? `−${Math.abs(value).toFixed(1)}`
        : "0.0";
