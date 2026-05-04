import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "IRB Prime Care",
    short_name: "IRB",
    description: "Clínica integrada em São José do Rio Preto.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2eee7",
    theme_color: "#12313c",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
