"use client";

import SearchBox from "../../client/components/SearchBox";
import styles from "./home.module.scss";
import Logo from "../../client/components/Logo";
import SuggestionPills from "../../client/components/SuggestionPills";
import { useEffect, useState } from "react";
import Header from "../../client/components/Header";
import Footer from "../../client/components/Footer";
import { useRouter } from "next/navigation";

export default function Index() {
  const router = useRouter();

  const handleSearchSubmit = async (pkg: string) => {
    router.push(`/search/docs/${pkg}`);
  };

  useEffect(() => {
    router.prefetch("/search/docs/foo");
  }, []);

  return (
    <div className={styles.homePageContainer}>
      <Header
        minimal={true}
        initialSearchValue={null}
        onSearchSubmit={handleSearchSubmit}
      />
      <div className={styles.homePageContent}>
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
        <div className={styles.searchContainer}>
          <SearchBox onSelect={(pkg) => handleSearchSubmit(pkg)} autoFocus />
        </div>
        <SuggestionPills />
      </div>
      <Footer />
    </div>
  );
}
