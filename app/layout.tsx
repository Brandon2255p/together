import type { Metadata, Viewport } from "next";
import { Figtree, Instrument_Serif } from "next/font/google";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});

export const metadata: Metadata = {
  title: { default: "Together", template: "%s · Together" },
  description: "Lists, plans, places and wishes — for the two of you.",
  appleWebApp: { capable: true, title: "Together", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#fbf8f4",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${figtree.variable} ${instrumentSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
