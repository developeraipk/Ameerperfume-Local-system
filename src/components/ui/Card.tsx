import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: "default" | "elevated" | "accent";
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = "default",
  className,
  ...props
}) => {
  const baseClasses = "rounded-xl border transition-all p-5";

  const variantClasses = {
    default: "bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-xs",
    elevated: "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/80 shadow-md shadow-slate-200/50 dark:shadow-black/40 text-slate-900 dark:text-slate-100",
    accent: "bg-gradient-to-br from-amber-50/80 to-white dark:from-slate-900 dark:to-amber-950/20 border-amber-300 dark:border-amber-500/30 text-slate-900 dark:text-slate-100",
  };

  return (
    <div className={twMerge(clsx(baseClasses, variantClasses[variant], className))} {...props}>
      {children}
    </div>
  );
};
