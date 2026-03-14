"use client";
import dynamic from "next/dynamic";

const EcoBotWidget = dynamic(() => import("@/components/shared/EcoBotWidget"), {
  ssr: false,
});

export default function ChatbotProvider() {
  return <EcoBotWidget />;
}
