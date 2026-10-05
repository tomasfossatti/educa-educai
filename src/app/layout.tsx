import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Educai", template: "%s · Educai" },
  description: "Inteligencia educativa basada en evidencia.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
