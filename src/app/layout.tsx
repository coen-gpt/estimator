import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CoenGPT Jobber Integration",
  description: "OAuth, webhook, and token management for Jobber"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
