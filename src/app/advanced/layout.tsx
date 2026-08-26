import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Advanced Mode - Money Stories",
  description: "Advanced Portfolio Analytics Module",
};

export default function AdvancedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-wrapper">
      {children}
    </div>
  );
}
