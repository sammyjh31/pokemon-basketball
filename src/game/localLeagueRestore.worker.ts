import { advanceLocalCpu, parseLocalLeague } from "./localLeague";
import type { LocalRestoreMessage } from "./localLeagueRestore";

const send = (message: LocalRestoreMessage) => self.postMessage(message);
self.onmessage = ({ data }: MessageEvent<string>) => {
  try {
    const draft = advanceLocalCpu(
      parseLocalLeague(data, (completed, total) =>
        send({ type: "progress", completed, total }),
      ),
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
