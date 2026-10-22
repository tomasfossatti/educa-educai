import type { Metadata } from "next";
import "./globals.css";
import { ObsidianExperience } from "@/components/obsidian/experience";

export const metadata: Metadata = {
  title: { default: "Educai", template: "%s · Educai" },
  description: "Inteligencia educativa basada en evidencia.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("educai-theme");if(t==="light"){document.documentElement.classList.remove("dark");}else if(t==="dark"){document.documentElement.classList.add("dark");}else if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches){document.documentElement.classList.remove("dark");}else{document.documentElement.classList.add("dark");}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen">
        <ObsidianExperience role={null} />
        {children}
      </body>
    </html>
  );
}
