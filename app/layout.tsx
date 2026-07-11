import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pocketwise — Personal finance, made clear",
  description: "A calm, modern dashboard for understanding your money.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased"
      >
        {children}
      </body>
    </html>
  );
}
