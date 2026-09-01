import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://monitor-represi-digital.nessiorion.chatgpt.site"),
  title: "Monitor Media HAM Indonesia",
  description:
    "Dashboard pemantauan media tentang represi digital, pelanggaran HAM dalam PSN, serta hak sipil dan politik di Indonesia sejak 1 Januari 2026.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Monitor Media HAM Indonesia",
    description: "Represi Digital · HAM dalam PSN · Hak Sipil dan Politik",
    images: [{ url: "/og.png", width: 1792, height: 924, alt: "Monitor Media HAM Indonesia" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Monitor Media HAM Indonesia",
    description: "Represi Digital · HAM dalam PSN · Hak Sipil dan Politik",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  );
}
