import type { MetadataRoute } from "next";

import { siteMeta } from "@/content/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/especialidades", "/equipe-medica", "/agendar"];

  return routes.map((route) => ({
    url: `${siteMeta.url}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.8,
  }));
}
