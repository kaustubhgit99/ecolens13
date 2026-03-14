import type { Metadata } from "next";
import { DM_Sans, Syne, JetBrains_Mono } from "next/font/google";
import ChatbotProvider from "@/components/shared/ChatbotProvider";
import "./globals.css";

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], weight: ["300","400","500","600"] });
const syne = Syne({ variable: "--font-syne", subsets: ["latin"], weight: ["400","500","600","700","800"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400","500"] });

export const metadata: Metadata = {
  title: "EcoLens — Amravati",
  description: "Civic intelligence platform for Amravati Municipal Corporation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${syne.variable} ${jetbrains.variable}`}>
        {children}
        <ChatbotProvider />
      </body>
    </html>
  );
}
