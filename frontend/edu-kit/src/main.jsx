
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import ThemeModeProvider from "./ThemeMode.jsx";
import "./theme.css";

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <ThemeModeProvider>
            <App />
        </ThemeModeProvider>
    </React.StrictMode>
);
