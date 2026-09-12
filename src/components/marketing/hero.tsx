import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronDown, Egg, Feather, HeartPulse, TrendingUp } from "lucide-react";
import { CountUp } from "./count-up";
import { HeroVideo } from "./hero-video";

/**
 * Full-bleed photographic hero.
 *
 * The photograph carries the page rather than sitting in a card beside it: the
 * subject is a working poultry house, so a visitor knows what this is for
 * before reading a word. Three images cross-fade slowly behind a layered
 * scrim, and the headline and figures arrive in sequence — enough motion to
 * feel alive, none of it fast enough to compete with reading.
 */

/**
 * These are photographs of a real customer's houses, not stock imagery — a
 * tiered layer house, a deep-litter flock, and the length of a cage run. They
 * pan in that order so the eye moves from one housing system to the other,
 * which is the claim the page makes: both are managed here.
 *
 * They carry no alt text because they are decorative: the headline sitting
 * over them already tells a screen reader what this page is.
 */
const SLIDES = [
  "/images/marketing/farm/layer-house.jpg",
  "/images/marketing/farm/deep-litter-house.jpg",
  "/images/marketing/farm/cage-rows.jpg",
];

/** Splits a line into words so each can rise in on its own beat. */
function Words({ text, start = 0 }: { text: string; start?: number }) {
  return (
    <>
      {text.split(" ").map((word, i) => (
        <span
          key={`${word}-${i}`}
          className="word-rise"
          style={{ animationDelay: `${start + i * 70}ms` }}
        >
          {word}
          {i < text.split(" ").length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}

function Metric({
  icon,
  children,
  label,
  delay,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  label: string;
  delay: number;
}) {
  return (
    <div
      className="rise mk-glass flex items-center gap-3 rounded-xl px-4 py-3 text-left"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/20 text-gold">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-display text-lg leading-none font-bold text-white tnum">
          {children}
        </p>
        <p className="mt-1 text-[0.6875rem] whitespace-nowrap text-white/70">{label}</p>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    // -mt-16/pt-16 pulls the photograph up behind the fixed header, so the
    // image is genuinely full-bleed rather than starting below a bar.
    <section className="relative isolate -mt-16 flex min-h-[38rem] flex-col justify-center overflow-hidden pt-16 lg:min-h-[44rem]">
      {/* ---------------------------------------------------- background -- */}
      {/* Four panels for three photographs: the first is repeated at the end
          so the loop back to the start cuts between identical frames.

          Each panel clips its own overflow, which is load-bearing: hero-drift
          scales the photograph past 1.0, and an unclipped panel lets that
          overflow paint across its neighbour — leaving a band of the next
          picture running down the edge of this one. */}
      <div className="absolute inset-0 -z-20 overflow-hidden" aria-hidden="true">
        <div className="hero-track flex h-full">
          {[...SLIDES, SLIDES[0]].map((src, i) => (
            <div
              key={`${src}-${i}`}
              className="relative h-full w-1/4 shrink-0 overflow-hidden"
            >
              <Image
                src={src}
                alt=""
                fill
                priority={i === 0}
                loading={i === 0 ? undefined : "eager"}
                sizes="100vw"
                className="hero-drift object-cover object-center"
                style={{ animationDelay: `${i * 3}s` }}
              />
            </div>
          ))}
        </div>

        {/* Phones get motion instead of the carousel — see HeroVideo for why
            it is not used on wide screens. It renders after the track so it
            paints over the photograph, and returns null wherever it should
            not play, leaving the stills exactly as they are. */}
        <HeroVideo />
      </div>

      {/* Two scrims rather than one: a vertical gradient anchors the type and
          fades the section into the page, and a flat wash guarantees contrast
          across the bright centre of the photograph. */}
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-darker/88 via-brand-darker/55 to-brand-darker/92"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 -z-10 bg-brand-darker/15 mix-blend-multiply"
        aria-hidden="true"
      />
      <div className="mk-grid-lines absolute inset-0 -z-10 opacity-25" aria-hidden="true" />

      {/* ------------------------------------------------------- content -- */}
      <div className="relative mx-auto w-full max-w-4xl px-4 py-20 text-center sm:px-6 lg:py-28">
        <span className="rise mk-glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-[0.1em] text-gold uppercase">
          <Feather className="h-3.5 w-3.5" />
          Built for Kenyan poultry
        </span>

        <h1 className="mt-6 font-display text-[2.5rem] leading-[1.05] font-extrabold tracking-tight text-white sm:text-5xl lg:text-[3.75rem]">
          <Words text="Run your poultry farm" start={120} />
          <br className="hidden sm:block" />{" "}
          <span className="text-gold">
            <Words text="smarter." start={400} />
          </span>
        </h1>

        <p
          className="rise mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg"
          style={{ animationDelay: "560ms" }}
        >
          EDOS Hatch360 brings flock management, production, health, feed,
          inventory, sales and profitability into one intelligent platform — on
          the phone already in your pocket, online or off.
        </p>

        <div
          className="rise mt-9 flex flex-col justify-center gap-3 sm:flex-row"
          style={{ animationDelay: "660ms" }}
        >
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-7 py-3.5 text-[0.9375rem] font-semibold text-brand-darker shadow-pop transition-transform hover:-translate-y-0.5 hover:bg-white"
          >
            Start managing your farm
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/features"
            className="mk-glass inline-flex items-center justify-center rounded-lg px-7 py-3.5 text-[0.9375rem] font-medium text-white transition-colors hover:bg-white/15"
          >
            Explore Hatch360
          </Link>
        </div>

        <p className="rise mt-5 text-sm text-white/60" style={{ animationDelay: "740ms" }}>
          Free on the Starter plan · No card needed · Works without signal
        </p>

        {/* Floating metrics (spec §6), counting up once as they arrive. Two
            columns on a phone so nothing is squeezed, four from tablet up. */}
        <div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric icon={<Feather className="h-4 w-4" />} label="Birds" delay={820}>
            <CountUp to={12450} />
          </Metric>
          <Metric icon={<Egg className="h-4 w-4" />} label="Eggs today" delay={900}>
            <CountUp to={9820} />
          </Metric>
          <Metric icon={<HeartPulse className="h-4 w-4" />} label="Mortality" delay={980}>
            <CountUp to={1.8} decimals={1} suffix="%" />
          </Metric>
          <Metric
            icon={<TrendingUp className="h-4 w-4" />}
            label="Profit this month"
            delay={1060}
          >
            <CountUp to={108} prefix="KES " suffix="K" />
          </Metric>
        </div>

        <p className="mt-4 text-[0.6875rem] text-white/40">
          Figures shown are a demonstration of a farm at scale, not a customer&apos;s records.
        </p>
      </div>

      <ChevronDown
        className="absolute bottom-5 left-1/2 h-5 w-5 -translate-x-1/2 text-white/40 motion-safe:animate-bounce"
        aria-hidden="true"
      />
    </section>
  );
}
