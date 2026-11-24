import React, { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { Theme, getInitialTheme, toggleTheme } from "@/lib/theme";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = "", showLabel = false }) => {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(getInitialTheme());
  }, []);

  const handleToggle = () => {
    const next = toggleTheme(theme);
    setTheme(next);
  };

  return (
    <button
      onClick={handleToggle}
      type="button"
      className={`relative inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer select-none ${
        theme === "light"
          ? "bg-amber-50/80 hover:bg-amber-100/80 border-amber-300/80 text-amber-800 shadow-sm"
          : "bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-amber-400"
      } ${className}`}
      title={theme === "light" ? "Switch to Dark Mode (Midnight Luxury)" : "Switch to Light Mode (Pearl Classic)"}
      aria-label="Toggle visual theme"
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        {theme === "light" ? (
          <Sun className="w-4 h-4 text-amber-600 animate-in fade-in zoom-in duration-200" />
        ) : (
          <Moon className="w-4 h-4 text-amber-400 animate-in fade-in zoom-in duration-200" />
        )}
      </div>
      {showLabel && (
        <span className="text-xs font-semibold tracking-wide">
          {theme === "light" ? "Light" : "Dark"}
        </span>
      )}
    </button>
  );
};
