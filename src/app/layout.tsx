import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portfolio Analyzer | MoneyStories",
  description: "Professional financial statement analyzer — track daily portfolio value, holdings, dividends, splits, deposits and withdrawals.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
