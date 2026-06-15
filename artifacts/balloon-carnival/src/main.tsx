import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initPixel } from "./lib/fbPixel";

initPixel();

createRoot(document.getElementById("root")!).render(<App />);
