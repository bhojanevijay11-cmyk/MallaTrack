type BrandHeaderProps = {
  appName?: string;
  tagline?: string;
};

const BRAND_LOGO_SRC = "/brand/mainmallatrack-logo.png";

export function BrandHeader({
  appName = "MallaTrack",
  tagline = "THE DISCIPLINED CURATOR",
}: BrandHeaderProps) {
  return (
    <header className="flex w-full min-w-0 flex-col items-center text-center">
      <div className="mb-5 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-violet-100 sm:mb-6 sm:h-28 sm:w-28">
        <img
          src={BRAND_LOGO_SRC}
          alt="MallaTrack"
          width={1254}
          height={1254}
          className="max-h-20 max-w-20 object-contain object-center sm:max-h-24 sm:max-w-24"
        />
      </div>

      <h1 className="text-[1.75rem] font-bold tracking-tight text-slate-900 sm:text-3xl md:text-[2rem]">
        {appName}
      </h1>

      <p className="mt-2 max-w-md text-[11px] font-medium uppercase leading-relaxed tracking-[0.28em] text-slate-400 sm:text-xs sm:tracking-[0.24em]">
        {tagline}
      </p>
    </header>
  );
}
