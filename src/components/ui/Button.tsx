import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = "primary",
  size = "md",
  disabled,
  ...props
}) => {
  const baseClasses =
    "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50 disabled:pointer-events-none rounded-lg cursor-pointer";

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base font-semibold",
  };

  const variantClasses = {
    primary: "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md font-semibold",
    secondary: "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-700",
    outline: "border border-amber-500/50 text-amber-800 dark:text-amber-400 hover:bg-amber-500/10",
    danger: "bg-rose-600 hover:bg-rose-500 text-white shadow-md",
    ghost: "hover:bg-slate-100 text-slate-600 hover:text-slate-900 dark:hover:bg-slate-800/60 dark:text-slate-300 dark:hover:text-white",
  };

  return (
    <button
      className={twMerge(clsx(baseClasses, sizeClasses[size], variantClasses[variant], className))}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
