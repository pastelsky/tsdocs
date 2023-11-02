import Head from "next/head";
import SearchBox from "../client/components/SearchBox";
import styles from "./index.module.scss";
import Logo from "../client/components/Logo";
import SuggestionPills from "../client/components/SuggestionPills";

export default function Home() {
  return (
    <>
      <div className={styles.homePageContent}>
        <div className={styles.logoContainer}>
          <Logo
            maxWidth="30rem"
            minWidth="20rem"
            fluidWidth="25vw"
            showAlpha={true}
          />
        </div>
        <div className={styles.tagline}>
          browse type documentation for an npm package
        </div>
        <div className={styles.searchContainer}>
          <SearchBox
            onSelect={(pkg) => {
              window.location.href = `/docs/${pkg}/index.html`;
            }}
          />
        </div>
        <SuggestionPills />
      </div>
    </>
  );
}
