import {
  ScrollViewStyleReset,
  useServerDocumentContext,
} from "expo-router/html";
import type { ReactNode } from "react";

export default function RootHtml({ children }: { children: ReactNode }) {
  const { bodyAttributes, bodyNodes, htmlAttributes, headNodes } =
    useServerDocumentContext();

  return (
    <html lang="ru" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta
          name="description"
          content="Logic Coin — копите монеты, выполняйте задания и сохраняйте ежедневную серию."
        />
        <meta name="theme-color" content="#0860F0" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="94aa68f9-beeb-43f3-9310-723b579dbc1b"
        />
        <script src="https://telegram.org/js/telegram-web-app.js" />
        <ScrollViewStyleReset />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
