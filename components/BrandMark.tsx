type BrandMarkSize = "sm" | "md" | "lg";

export type BrandMarkProps = {
  size?: BrandMarkSize;
  className?: string;
};

const SIZE: Record<BrandMarkSize, { box: string; text: string }> = {
  sm: { box: "h-8 w-8", text: "text-sm" }, // 32px
  md: { box: "h-10 w-10", text: "text-base" }, // 40px
  lg: { box: "h-14 w-14", text: "text-2xl" }, // 56px
} as const;

export function BrandMark({ size = "md", className }: BrandMarkProps) {
  const s = SIZE[size];
  const extra = className?.trim() ? ` ${className.trim()}` : "";
  return (
    <div
      aria-hidden
      className={`${s.box} inline-flex items-center justify-center rounded-[18px] bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 text-white shadow-sm ring-1 ring-emerald-600/20${extra}`}
    >
      <span className={`${s.text} font-bold leading-none tracking-tight`}>M</span>
    </div>
  );
}

