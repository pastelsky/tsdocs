import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@200;400;600&display=swap"
          rel="stylesheet"
        />
        <title>TS Docs | Reference docs for npm packages</title>
        <meta
          name="title"
          content="TS Docs | Reference docs for npm packages"
        />
        <meta
          name="description"
          content="Find type documentation for any npm library that ships with types or has publically available types on Definitely Typed"
        />

        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://tsdocs.dev/" />
        <meta
          property="og:title"
          content="TS Docs | Reference docs for npm packages"
        />
        <meta
          property="og:description"
          content="Find type documentation for any npm library that ships with types or has publically available types on Definitely Typed"
        />
        <meta property="og:image" content="https://tsdocs.dev/og-image.png" />

        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://tsdocs.dev/" />
        <meta
          property="twitter:title"
          content="TS Docs | Reference docs for npm packages"
        />
        <meta
          property="twitter:description"
          content="Find type documentation for any npm library that ships with types or has publically available types on Definitely Typed"
        />
        <meta
          property="twitter:image"
          content="https://tsdocs.dev/og-image.png"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
