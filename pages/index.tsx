import SearchBox from "../client/components/SearchBox";
import styles from "./index.module.scss";
import Logo from "../client/components/Logo";
import SuggestionPills from "../client/components/SuggestionPills";
import { useState } from "react";
import { getPackageDocs } from "../client/api/get-package-docs";
import Loader from "../client/components/Loader";
import Header from "../client/components/Header";
import Footer from "../client/components/Footer";
import { useRouter } from "next/router";

export default function Home() {
  const [pkg, setPkg] = useState<string | null>(null);

  const router = useRouter();

  const handleSearchSubmit = async (pkg: string) => {
    window.location.pathname = `/docs/${pkg}`;
  };

  return (
    <div className={styles.homePageContainer}>
      <Header
        minimal={true}
        initialSearchValue={pkg}
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
          <SearchBox onSelect={(pkg) => handleSearchSubmit(pkg)} />
        </div>
        <SuggestionPills />
      </div>
      <Footer />
    </div>
  );
}
