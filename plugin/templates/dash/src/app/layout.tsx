import '@holiday-cfo/ui/globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
