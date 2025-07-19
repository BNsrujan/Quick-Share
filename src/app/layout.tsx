import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ErrorProvider } from "../contexts/ErrorContext";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { AuthProviderWithSession } from "../contexts/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Quick-Share P2P | Secure File Sharing",
  description: "Ultra-secure peer-to-peer file sharing platform with end-to-end encryption and no server storage",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ErrorProvider>
          <AuthProviderWithSession>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </AuthProviderWithSession>
        </ErrorProvider>
      </body>
    </html>
  );
}
