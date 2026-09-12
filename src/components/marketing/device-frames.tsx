import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Device frames for the product showcase.
 *
 * The screenshots inside are genuine captures of the running application
 * against the demonstration farm — not drawn mockups — so what a visitor sees
 * here is what the product actually looks like. The bezels are CSS rather
 * than images so they stay crisp at any size and cost nothing to download.
 */

export function PhoneFrame({
  src,
  alt,
  caption,
  className,
  priority = false,
}: {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <figure className={cn("flex flex-col items-center", className)}>
      {/* No notch or island: a cutout would sit over the app's own header and
          read as a rendering fault rather than as a phone. The bezel and
          corner radius carry it. */}
      <div className="relative w-full max-w-[15rem] rounded-[2.25rem] border-[0.6rem] border-ink bg-ink shadow-pop ring-1 ring-black/10">
        <div className="relative aspect-[390/844] overflow-hidden rounded-[1.7rem] bg-canvas">
          <Image
            src={src}
            alt={alt}
            fill
            priority={priority}
            sizes="(max-width: 640px) 60vw, 240px"
            className="object-cover object-top"
          />
        </div>
      </div>

      {caption && (
        <figcaption className="mt-3 max-w-[15rem] text-center text-xs leading-relaxed text-ink-soft">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

export function LaptopFrame({
  src,
  alt,
  caption,
  className,
  priority = false,
}: {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <figure className={cn("flex w-full flex-col items-center", className)}>
      <div className="w-full">
        {/* Lid */}
        <div className="relative rounded-t-xl border-[0.55rem] border-b-0 border-ink bg-ink shadow-raised">
          <div className="relative aspect-[1440/900] overflow-hidden rounded-t-[0.35rem] bg-canvas">
            <Image
              src={src}
              alt={alt}
              fill
              priority={priority}
              sizes="(max-width: 1024px) 100vw, 680px"
              className="object-cover object-top"
            />
          </div>
        </div>

        {/* Base — the slight overhang and notch are what read as "laptop". */}
        <div className="relative mx-auto h-3 w-[104%] -translate-x-[2%] rounded-b-xl bg-ink shadow-lg">
          <span
            className="absolute top-0 left-1/2 h-1.5 w-16 -translate-x-1/2 rounded-b-md bg-white/15"
            aria-hidden="true"
          />
        </div>
      </div>

      {caption && (
        <figcaption className="mt-4 max-w-md text-center text-xs leading-relaxed text-ink-soft">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
