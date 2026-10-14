import type { Metadata } from "next";
import "./globals.css";
import { ObsidianExperience } from "@/components/obsidian/experience";

export const metadata: Metadata = {
  title: { default: "Educai", template: "%s · Educai" },
  description: "Inteligencia educativa basada en evidencia.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen">
        <ObsidianExperience role={null} />
        {children}
      </body>
    </html>
  );
}
