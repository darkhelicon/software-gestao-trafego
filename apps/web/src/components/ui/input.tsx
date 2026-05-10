import { forwardRef } from "react";
import { clsx } from "clsx";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={id}
            className="text-sm font-medium text-gray-300"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={clsx(
            "h-10 w-full rounded-lg border bg-white/5 px-3 text-sm text-white outline-none transition-colors",
            "placeholder:text-gray-600",
            "focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20",
            error
              ? "border-red-400/60 focus:border-red-500 focus:ring-red-500/20"
              : "border-white/10",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
