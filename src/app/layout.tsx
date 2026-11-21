import type { Metadata, Viewport } from "next";
import { Work_Sans, Young_Serif } from "next/font/google";
import { ServiceWorker } from "@/components/layout/service-worker";
import { site } from "@/config/site";
import { env } from "@/lib/env";
import "./globals.css";

const youngSerif = Young_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-young-serif",
  display: "swap",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-work-sans",
  display: "swap",
});

export const metadata: Metadata = {
  // Base des adresses absolues (canoniques, Open Graph) : l'adresse publique du site.
  metadataBase: new URL(env.APP_URL),
  title: {
    default: `${site.name} — ${site.baseline} à ${site.city}`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  applicationName: site.shortName,
  icons: {
    icon: [
      { url: "/logos/favicon.svg", type: "image/svg+xml" },
      { url: "/logos/icone-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/logos/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: site.shortName, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  // Valeurs par défaut du partage ; l'image vient de app/opengraph-image.tsx.
  openGraph: {
    type: "website",
    siteName: site.name,
    locale: site.locale,
    title: `${site.name} — ${site.baseline} à ${site.city}`,
    description: site.description,
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: site.themeColor,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${youngSerif.variable} ${workSans.variable}`}>
      <body className="flex min-h-dvh flex-col">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
