import type { Metadata, Viewport } from "next";
import { Inter, Manrope, Open_Sans } from "next/font/google";
import "./globals.css";

/*
 * Two typographic voices, deliberately.
 *
 * The marketing site is a brochure and keeps Manrope's tighter, more
 * emphatic display face. The application is a working tool used in a poultry
 * house on a cheap phone in daylight, so it runs on Open Sans: open
 * apertures, a tall x-height, and lighter heading weights that stay quiet
 * over long working sessions. The app scope is applied in globals.css under
 * `.app-ui`.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "EDOS Hatch360 — Poultry farm management software for Kenya",
    template: "%s · EDOS Hatch360",
  },
  description:
    "EDOS Hatch360 brings flock management, egg production, bird health, feed, inventory, sales and profitability into one platform built for Kenyan poultry farms. Works offline, works on your phone.",
  applicationName: "EDOS Hatch360",
  keywords: [
    "poultry management software Kenya",
    "poultry farm management system",
    "chicken farm management software",
    "layer farm management",
    "broiler farm management",
    "poultry production management",
    "poultry inventory software",
    "kienyeji farming records",
  ],
  authors: [{ name: "EDOS Centre" }],
  openGraph: {
    type: "website",
    siteName: "EDOS Hatch360",
    locale: "en_KE",
    url: SITE_URL,
    title: "EDOS Hatch360 — Every bird. Every batch. Every farm.",
    description:
      "The smarter way to manage every bird, batch and farm. Flock, production, health, feed, sales and profit in one place.",
  },
  twitter: {
    card: "summary_large_image",
    title: "EDOS Hatch360 — Poultry farm management for Kenya",
    description:
      "Know your flock, control your costs and grow your poultry business.",
  },
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#1b5e42",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${manrope.variable} ${openSans.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
