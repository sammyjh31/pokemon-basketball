import { useState } from "react";
import type { TrainerCoach } from "../game/trainerCoaches";
import "../coaches.css";

const illustrated = new Set(["gary", "jessie", "james", "mom"]);

export function CoachPortrait({
  coach,
  size = "standard",
}: {
  coach: TrainerCoach;
  size?: "standard" | "large" | "small";
}) {
  const src = `/coaches/${coach.id}.png`;
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span className={`coach-portrait coach-portrait-${size}`}>
      {failed === src ? (
        <span className="coach-portrait-fallback" aria-label={coach.name}>
          {coach.id === "mom"
            ? "MOM"
            : coach.name
                .replace("Professor ", "")
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")}
        </span>
      ) : (
        <img
          src={src}
          alt={coach.name}
          className={
            illustrated.has(coach.id) ? "coach-artwork" : "coach-sprite"
          }
          width={128}
          height={128}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(src)}
        />
      )}
    </span>
  );
}
