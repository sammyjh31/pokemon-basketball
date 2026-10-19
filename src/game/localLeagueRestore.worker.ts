import { restoreLocalCareerSource } from "./localCareerCache";
import { browserReplayCache } from "./browserReplayCache";
import type { LocalRestoreMessage } from "./localLeagueRestore";

const send = (message: LocalRestoreMessage) => self.postMessage(message);
self.onmessage = async ({ data }: MessageEvent<string>) => {
  try {
    const { draft } = await restoreLocalCareerSource(
      data,
      (completed, total) => send({ type: "progress", completed, total }),
      new AbortController().signal,
      browserReplayCache(),
    );
    send({ type: "complete", draft });
  } catch (error) {
    send({
      type: "error",
      message:
        error instanceof Error
          ? error.message
          : "This saved local league could not be verified.",
    });
  }
};
