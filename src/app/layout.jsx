import "./globals.css";
import Script from "next/script";
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
        <Script
          id="block-map-loader"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              fetch('/mc/block_textures_map.json')
                .then(r => r.json())
                .then(data => { globalThis.FULL_BLOCK_MAP = data; })
                .catch(() => { console.warn('No se pudo cargar el mapeo oficial de bloques'); });
            `,
          }}
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
