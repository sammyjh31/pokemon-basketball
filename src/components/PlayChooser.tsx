import { Dialog } from "./Dialog";
import type { PlayStyle } from "./onboarding";

const OPTIONS: {
  style: PlayStyle;
  title: string;
  tag?: string;
  goal: string;
}[] = [
  {
    style: "challenge",
    title: "82–0 Challenge",
    goal: "Pick from four random Pokémon each round, with two re-rolls, and chase a perfect 82–0 season.",
  },
  {
    style: "free",
    title: "Free build",
    goal: "Choose any eight of 251 Pokémon and see how far your dream lineup goes.",
  },
  {
    style: "franchise",
    title: "Franchise",
    tag: "After a season",
    goal: "Finish one season, then keep your team for years of development, drafts, trades and free agency.",
  },
  {
    style: "local",
    title: "Local league",
    goal: "Snake-draft against friends on one device, then play a full league season together.",
  },
];

export function PlayChooser({
  current,
  onChoose,
  onClose,
}: {
  current?: PlayStyle;
  onChoose: (style: PlayStyle) => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      className="confirm-dialog play-chooser"
      eyebrow="WELCOME TO 82–0"
      title="How do you want to play?"
      description="Every mode starts by drafting eight Pokémon. You can switch any time from How to play in the header."
      onClose={onClose}
    >
      <ul className="play-options">
        {OPTIONS.map((option) => (
          <li key={option.style}>
            <button
              type="button"
              className="play-option"
              aria-current={current === option.style ? "true" : undefined}
              onClick={() => onChoose(option.style)}
            >
              <strong>
                {option.title}
                {option.tag && <small>{option.tag}</small>}
              </strong>
              <span>{option.goal}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="dialog-actions">
        <button type="button" className="button secondary" onClick={onClose}>
          Decide later
        </button>
      </div>
    </Dialog>
  );
}
