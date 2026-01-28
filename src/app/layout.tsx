import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppProvider } from "@/contexts/AppContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { Toaster } from "@/components";

const poppins = Poppins({ 
  subsets: ["latin"],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  title: "Assistly - Virtual Assistant Solutions",
  description: "Professional virtual assistant services including chatbots, AI voice agents, and lead generation for your business",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={poppins.className}>
        <AuthProvider>
          <AppProvider>
            <SidebarProvider>
              {children}
              <Toaster />
            </SidebarProvider>
          </AppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
