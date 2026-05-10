import { clsx } from "clsx";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  highlight?: boolean;
}

export function Card({ className, highlight, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-xl border bg-white/[0.03] p-6",
        highlight && "border-brand-400 ring-2 ring-brand-400/20",
        !highlight && "border-white/10",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("mb-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={clsx("text-lg font-semibold text-white", className)} {...props}>
      {children}
    </h3>
  );
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("text-sm text-gray-400", className)} {...props}>
      {children}
    </div>
  );
}
