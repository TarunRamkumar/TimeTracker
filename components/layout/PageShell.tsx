import type { ReactNode } from 'react';

type PageShellProps = {
  children: ReactNode;
  className?: string;
};

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div
      className={`flex w-full min-w-0 flex-col gap-6 px-3 py-6 sm:px-4 lg:px-5 xl:px-6${
        className ? ` ${className}` : ''
      }`}
    >
      {children}
    </div>
  );
}
