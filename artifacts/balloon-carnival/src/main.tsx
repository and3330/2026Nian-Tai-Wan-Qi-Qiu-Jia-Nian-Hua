import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initPixel } from "./lib/fbPixel";

// After a redeploy, hashed chunk filenames change; visitors with a stale page
// fail to lazy-load modules ("Failed to fetch dynamically imported module").
// Reload once (guarded by sessionStorage) to pick up the new build.
window.addEventListener("vite:preloadError", (event) => {
  const key = "chunk-reload-at";
  const last = Number(sessionStorage.getItem(key) || 0);
  if (Date.now() - last > 60_000) {
    sessionStorage.setItem(key, String(Date.now()));
    event.preventDefault();
    window.location.reload();
  }
});

initPixel();

createRoot(document.getElementById("root")!).render(<App />);
