import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { installAuthTransport } from "./utils/authTransport";

installAuthTransport();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
