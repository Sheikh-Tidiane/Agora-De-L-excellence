import type { Metadata } from "next";
import { site } from "@/config/site";
import { ActivitiesSection } from "@/features/home/components/activities-section";
import { Dimensions } from "@/features/home/components/dimensions";
import { EventsSection } from "@/features/home/components/events-section";
import { Hero } from "@/features/home/components/hero";
import { LaunchSection } from "@/features/home/components/launch-section";
import { LibrarySection } from "@/features/home/components/library-section";
import { MembershipCall } from "@/features/home/components/membership-call";
import { NewsSection } from "@/features/home/components/news-section";
import { env } from "@/lib/env";
import { serializeJsonLd } from "@/lib/json-ld";
import { ForVisitors } from "@/components/layout/by-viewer";

export const metadata: Metadata = {
  description: site.description,
  alternates: { canonical: "/" },
};

/** Données structurées : le club, tel que les moteurs de recherche peuvent le présenter. */
const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.name,
  alternateName: site.shortName,
  slogan: site.slogan,
  description: site.description,
  url: env.APP_URL,
  logo: `${env.APP_URL}/logos/monogramme-1024.png`,
  address: { "@type": "PostalAddress", addressLocality: site.city, addressCountry: "SN" },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(organization) }}
      />
      <Hero />
      <LaunchSection />
      <Dimensions />
      <LibrarySection />
      <ActivitiesSection />
      <EventsSection />
      <NewsSection />
      <ForVisitors>
        <MembershipCall />
      </ForVisitors>
    </>
  );
}
