import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Block Maps · every NYC map, one place",
  description:
    "Block Maps aggregates every public NYC map into themed meta-maps and makes them queryable through a natural-language agent. Hosted at maps.nyc.network.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
