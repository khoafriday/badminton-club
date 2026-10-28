import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { LIGHT_THEME_COLOR, themeScript } from "./ui/theme";
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
  // The theme script switches it to the dark colour when Tối is picked.
  themeColor: LIGHT_THEME_COLOR,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The script sets data-theme before paint, so the server markup differs on purpose.
    <html lang="vi" data-theme="light" className={`h-full antialiased ${font.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full bg-page font-sans text-ink">
        <div className="mx-auto flex min-h-full w-full max-w-md flex-col">{children}</div>
      </body>
    </html>
  );
}
