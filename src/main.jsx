import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import IDPSetup from "./IDPSetup";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <IDPSetup />
  </StrictMode>
);
