import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Life OS Dashboard",
  description: "Everything in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
      </body>
    </html>
  );
}
