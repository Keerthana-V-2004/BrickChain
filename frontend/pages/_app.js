import "../styles/globals.css";
import Head from "next/head";
import { Inter } from "next/font/google";

const interfaceFont = Inter({
  subsets: ["latin"],
  variable: "--font-interface",
  display: "swap",
});

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>EstateHub dApp | Property Listings</title>
        <link rel="icon" href="/property-mark.svg" type="image/svg+xml" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <div className={`app-shell ${interfaceFont.variable}`}>
        <Component {...pageProps} />
      </div>
    </>
  );
}
