import ReactDOM from "react-dom/client";
import { MotionConfig } from "framer-motion";
import App from "./App";
import { DUR, EASE_OUT } from "./motion";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  // reducedMotion="user" makes Framer Motion skip transform/layout animation
  // for users who asked for less motion; the CSS in index.css covers the rest.
  <MotionConfig reducedMotion="user" transition={{ duration: DUR.base, ease: EASE_OUT }}>
    <App />
  </MotionConfig>,
);
