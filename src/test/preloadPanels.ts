import { preloadPanels } from "../components/lazyPanels";
// App code-splits its heavy panels; load them up front so tests can query
// synchronously, matching the browser once the idle preload has finished.
await preloadPanels();
