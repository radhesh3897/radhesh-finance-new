import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finance Dashboard — Personal finance, made clear",
  description: "A calm, modern dashboard for tracking Indian income, expenses, clients, and insights.",
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
