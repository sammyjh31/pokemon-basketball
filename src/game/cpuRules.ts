import type { Franchise } from "./franchiseTypes";

/** Whether the current (or given) offseason year runs under CPU rules version 1. */
export function cpuRulesApply(
  franchise: Pick<Franchise, "cpuRules" | "year">,
  year = franchise.year,
): boolean {
  return (
    franchise.cpuRules?.modelVersion === 1 && year >= franchise.cpuRules.since
  );
}
