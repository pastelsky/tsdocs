import "./global.css";
import { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["200", "400", "600"],
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tsdocs.dev"),
  title: "TS Docs | Reference docs for npm packages",
  applicationName: "TS Docs",
  description: "Generate type documentation for npm libraries",
  openGraph: {
    type: "website",
    url: "https://tsdocs.dev/",
    title: "TS Docs | Reference docs for npm packages",
    description: "Generate type documentation for npm libraries",
    images: [
      {
        url: "https://tsdocs.dev/og-image.png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "https://tsdocs.dev/",
    title: "TS Docs | Reference docs for npm packages",
    description: "Generate type documentation for npm libraries",
    images: [
      {
        url: "https://tsdocs.dev/og-image.png",
      },
    ],
  },
  manifest: "/site.webmanifest",
  icons: [
    {
      url: "/apple-touch-icon.png",
      sizes: "180x180",
      rel: "apple-touch-icon",
      type: "image/png",
    },
    {
      url: "/favicon-32x32.png",
      rel: "icon",
      sizes: "32x32",
      type: "image/png",
    },
    {
      url: "/favicon-16x16.png",
      rel: "icon",
      sizes: "16x16",
      type: "image/png",
    },
  ],
};

export const viewport: Viewport = {
  themeColor: "#2C75D5",
  width: "device-width",
  initialScale: 1,
};

function Layout({ children }) {
  return (
    <html className={jetbrainsMono.className}>
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  );
}

export default Layout;
