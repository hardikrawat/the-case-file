import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { AuthProvider } from "@/components/providers/AuthProvider";

import { ThemeProvider } from "@/components/providers/ThemeProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "The Case File",
  description: "Digital Detective Board",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="noise-overlay" />
        <AuthProvider>
          <ThemeProvider>
            {children}
            <Toaster position="top-center" richColors theme="dark" />
          </ThemeProvider>
          {/* Global SVG Filters for Detective Board Elements */}
          <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
            <defs>
              <filter id="yarn-texture" x="-20%" y="-20%" width="140%" height="140%">
                {/* Create fine fibers */}
                <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G" result="frayed" />

                {/* Add fuzzy glow/fiber halo */}
                <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" result="blur" />
                <feComposite in="frayed" in2="blur" operator="over" />

                {/* Grainy highlights */}
                <feComponentTransfer>
                  <feFuncA type="table" tableValues="0 1 1 1" />
                </feComponentTransfer>
              </filter>
            </defs>
          </svg>
        </AuthProvider>
      </body>
    </html>
  );
}
