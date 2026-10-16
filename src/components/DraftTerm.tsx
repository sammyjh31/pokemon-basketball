import { useId, type ReactNode } from "react";

export const DRAFT_TERMS = {
  fit: "Fit is a 0–100 rating for how well a Pokémon's tools suit a position and your open roles.",
  impact:
    "Impact is the projected change to your team's offense and defense ratings if you draft this Pokémon.",
  baseline:
    "Your current roster is first rearranged into its best lineup. Each pick is compared with that, so it gets no credit for fixing positions you could already change.",
} as const;

/** A focusable term with a short explanation on hover, focus or tap. */
export function DraftTerm({
  term,
  children,
}: {
  term: keyof typeof DRAFT_TERMS;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <span className="draft-term">
      <button
        type="button"
        className="draft-term-trigger"
        aria-describedby={id}
      >
        {children}
        <span aria-hidden="true">ⓘ</span>
      </button>
      <span role="tooltip" id={id} className="draft-term-tip">
        {DRAFT_TERMS[term]}
      </span>
    </span>
  );
}
