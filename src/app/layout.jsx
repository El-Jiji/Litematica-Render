import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

export const metadata = {
  title: "Litematica Render",
  description: "Renderiza tus archivos .litematic directamente en el navegador",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <meta
          name="google-site-verification"
          content="jj8umSgUSyogvEwNDRRw-yJed2MT4TS7cPTfI43LntM"
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
