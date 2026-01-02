import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/firebase/auth-context";
import { ThemeProvider, themeScript } from "@/lib/theme-context";
import { AuthGuard } from "@/components/auth/auth-guard";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SafeBalance",
  description: "Personal Finance PWA with AI-powered receipt scanning",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SafeBalance",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {/* Blocking script to prevent FOUC - runs before React hydrates */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <AuthProvider>
            <AuthGuard>
              {children}
            </AuthGuard>
          </AuthProvider>
        </ThemeProvider>
        <Toaster
          position="top-center"
          richColors
          toastOptions={{
            duration: 4000,
            className: 'toast-theme',
          }}
        />
      </body>
    </html>
  );
}
