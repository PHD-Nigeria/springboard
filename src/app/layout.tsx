import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { PageTransition } from "@/components/motion/PageTransition";

export const metadata: Metadata = {
  title: "Springboard | PHD Nigeria",
  description: "PHD Nigeria Springboard — digital editorial platform.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <Navigation />
        <PageTransition>{children}</PageTransition>
        <Footer />
      </body>
    </html>
  );
}
