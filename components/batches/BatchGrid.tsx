import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export function BatchGrid({ children }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:gap-3 md:grid-cols-2 md:gap-3">{children}</div>
  );
}
