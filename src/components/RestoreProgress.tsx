export function RestoreProgress({
  completed,
  total,
  label,
}: {
  completed: number;
  total: number;
  label: string;
}) {
  return (
    <div className="league-simulation-progress" role="status">
      <span>
        {total > 0
          ? `${completed.toLocaleString("en-US")} / ${total.toLocaleString("en-US")} games restored`
          : "Opening saved league…"}
      </span>
      <progress aria-label={label} value={completed} max={Math.max(1, total)} />
    </div>
  );
}
