import type { Metadata } from "next";
import { Fraunces, Nunito, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"], weight: ["500", "700", "800"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["500", "700"] });

export const metadata: Metadata = {
  title: "Bedtime Saga · a bedtime story that remembers",
  description: "An Alexa+ add-on (MCP server + MCP Apps) that continues a child's bedtime saga night after night, with parent guardrails enforced by Strands Agents hooks.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fraunces.variable} ${nunito.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
