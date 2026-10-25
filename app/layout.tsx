import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const font = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-app",
});

export const metadata: Metadata = {
  title: "Badminton Club",
  description: "Quản lý thành viên, lịch đánh và thu chi của CLB cầu lông",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8faf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0c110f" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`h-full antialiased ${font.variable}`}>
      <body className="min-h-full bg-page font-sans text-ink">
        <div className="mx-auto flex min-h-full w-full max-w-md flex-col">{children}</div>
      </body>
    </html>
  );
}
