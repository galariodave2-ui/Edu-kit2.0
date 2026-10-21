import { useEffect, useState } from "react";

export default function ThemeModeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem("edu-kit-theme") === "dark"
            ? "dark"
            : "light";
    });

    useEffect(() => {
        document.documentElement.setAttribute("data-bs-theme", theme);
        document.body.setAttribute("data-bs-theme", theme);
        localStorage.setItem("edu-kit-theme", theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((current) =>
            current === "light" ? "dark" : "light"
        );
    };

    return (
        <>
            {children}

            <button
                type="button"
                className="theme-toggle-btn"
                onClick={toggleTheme}
                aria-label={
                    theme === "dark"
                        ? "Switch to light mode"
                        : "Switch to dark mode"
                }
                aria-pressed={theme === "dark"}
                title={
                    theme === "dark"
                        ? "Switch to light mode"
                        : "Switch to dark mode"
                }
            >
                <span className="theme-toggle-icon" aria-hidden="true">
                    {theme === "dark" ? "☀️" : "🌙"}
                </span>
                <span>
                    {theme === "dark" ? "Light Mode" : "Dark Mode"}
                </span>
            </button>
        </>
    );
}