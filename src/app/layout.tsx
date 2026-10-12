import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Things",
  description: "Save anything for later.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
