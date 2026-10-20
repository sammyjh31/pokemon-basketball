import { useEffect, useState } from "react";
import { toPng } from "html-to-image";
import { lineupLink } from "../game/lineup";
import type { Run } from "../game/types";

export function LineupTools({
  run,
  onRandomize,
  onClear,
}: {
  run: Run;
  onRandomize: () => void;
  onClear: () => void;
}) {
  const [notice, setNotice] = useState("");
  const [fallback, setFallback] = useState("");
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    setNotice("");
    setFallback("");
  }, [run.roster, run.draftPool]);
  const filled = Object.values(run.roster).some((id) => id !== null);
  const copy = async () => {
    const link = lineupLink(window.location.href, run.roster, run.draftPool);
    try {
      await navigator.clipboard.writeText(link);
      setNotice("Lineup link copied.");
      setFallback("");
    } catch {
      setFallback(link);
      setNotice("Copy your lineup link below.");
    }
  };
  const download = async () => {
    const court = document.querySelector<HTMLElement>(".court-column");
    if (!court || exporting) return;
    setExporting(true);
    try {
      await document.fonts.ready;
      await Promise.all(
        [...court.querySelectorAll("img")].map((img) =>
          img.decode().catch(() => undefined),
        ),
      );
      const data = await toPng(court, {
        pixelRatio: 2,
        backgroundColor: "#0f1318",
      });
      const link = document.createElement("a");
      link.download = "pokemon-basketball-lineup.png";
      link.href = data;
      link.click();
      setNotice("Image download started.");
    } catch {
      setNotice(
        "The image could not be saved. Try again or copy a lineup link.",
      );
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="lineup-tools">
      <div className="share-actions">
        <button
          className="button light"
          disabled={!filled || exporting}
          onClick={download}
        >
          {exporting ? "Saving…" : "Save image"}
        </button>
        <button className="button secondary" disabled={!filled} onClick={copy}>
          Copy link
        </button>
      </div>
      {run.mode === "free" && !run.result && (
        <div className="builder-actions">
          <button onClick={onRandomize}>Randomize</button>
          <button disabled={!filled} onClick={onClear}>
            Clear all
          </button>
        </div>
      )}
      {notice && (
        <p className="tool-notice" role="status">
          {notice}
        </p>
      )}
      {fallback && (
        <input
          className="share-fallback"
          aria-label="Lineup link"
          value={fallback}
          readOnly
          onFocus={(event) => event.target.select()}
        />
      )}
    </div>
  );
}
