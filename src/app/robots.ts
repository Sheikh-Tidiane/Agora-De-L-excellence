import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/**
 * Le site public est ouvert aux moteurs de recherche ; les espaces connectés, les pages de compte,
 * les liens personnels (inscription d'un invité) et les fichiers techniques ne le sont pas.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/member",
          "/api/",
          "/login",
          "/activate",
          "/forgot-password",
          "/reset-password",
          "/access-denied",
          "/events/registration",
          "/offline",
          "/design-system",
        ],
      },
    ],
    sitemap: `${env.APP_URL}/sitemap.xml`,
    host: env.APP_URL,
  };
}
