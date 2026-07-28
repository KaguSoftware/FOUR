import type { Metadata, Viewport } from "next";
import { Archivo_Black, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

/**
 * Wordmark only — never body text or labels.
 *
 * A single heavy grotesque used once per screen reads as a machine label
 * stamped on a panel. Used anywhere else it would turn into decoration, which
 * this register does not have room for.
 */
const archivoBlack = Archivo_Black({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "uptime",
  description: "Uptime monitor for one body.",
  // Added to the home screen from Safari, this launches without browser
  // chrome. `black-translucent` lets the near-black background run under the
  // status bar instead of leaving a pale strip above it.
  appleWebApp: {
    capable: true,
    title: "uptime",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false, date: false, address: false, email: false },
};

export const viewport: Viewport = {
  themeColor: "#0d1013",
  width: "device-width",
  initialScale: 1,
  // Fixed scale: this is a tool you tap, not a document you read. Pinch-zoom
  // and the double-tap-to-zoom delay both get in the way of a two-tap log.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${archivoBlack.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
