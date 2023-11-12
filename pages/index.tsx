import Head from "next/head";
import SearchBox from "../client/components/SearchBox";
import styles from "./index.module.scss";
import Logo from "../client/components/Logo";
import SuggestionPills from "../client/components/SuggestionPills";
import { useState } from "react";
import { getPackageDocs } from "../client/api/get-package-docs";
import Loader from "../client/components/Loader";
import Header from "../client/components/Header";
import Heart from "../client/assets/heart.svg";
import Footer from "../client/components/Footer";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [pkg, setPkg] = useState<string | null>(null);

  const handleSearchSubmit = async (pkg: string) => {
    setLoading(true);
    setPkg(pkg);

    try {
      await getPackageDocs(pkg);
      window.location.href = `/docs/${pkg}/index.html`;
    } catch (err) {
      console.error(err);
      setLoading(false);
    } finally {
      // Ideally set `loading` to false, but we navigate away anyways
    }
  };

  return (
    <div className={styles.homePageContainer}>
      <Header
        minimal={!loading}
        initialSearchValue={pkg}
        onSearchSubmit={handleSearchSubmit}
      />
      <div className={styles.homePageContent}>
        {!loading && (
          <>
            <div className={styles.logoContainer}>
              <Logo
                maxWidth="30rem"
                minWidth="20rem"
                fluidWidth="25vw"
                showAlpha={true}
                showImage={true}
              />
            </div>
            <div className={styles.tagline}>
              browse type documentation for npm packages
            </div>
          </>
        )}
        {!loading && (
          <div className={styles.searchContainer}>
            <SearchBox
              onSelect={(pkg) => handleSearchSubmit(pkg)}
              initialValue="foo"
            />
          </div>
        )}
        {!loading && <SuggestionPills />}
        {loading && <Loader />}
      </div>
      <Footer />
    </div>
  );
}
