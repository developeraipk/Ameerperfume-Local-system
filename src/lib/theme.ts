export type Theme = "light" | "dark";

const THEME_KEY = "ameer_theme";

export const getInitialTheme = (): Theme => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") {
      return saved;
    }
  }
  return "light"; // Default to light mode per client requirement
};

export const applyTheme = (theme: Theme) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
    root.style.colorScheme = "dark";
  } else {
    root.classList.add("light");
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  }
  localStorage.setItem(THEME_KEY, theme);
};

export const toggleTheme = (currentTheme: Theme): Theme => {
  const nextTheme: Theme = currentTheme === "light" ? "dark" : "light";
  applyTheme(nextTheme);
  return nextTheme;
};
