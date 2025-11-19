import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

const THEME_KEY = "theme";

const getPreferredTheme = (): "dark" | "light" => {
  if (typeof window === "undefined") return "light";
  const ls = localStorage.getItem(THEME_KEY);
  if (ls === "dark" || ls === "light") return ls;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<"dark" | "light">("light");

  useEffect(() => {
    const initial = getPreferredTheme();
    setTheme(initial);
    if (initial === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (e) {
      // ignore
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={toggle} title={`Tema: ${theme === "dark" ? "Escuro" : "Claro"}`}>
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="sr-only">Alternar tema</span>
    </Button>
  );
};

export default ThemeToggle;
