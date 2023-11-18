"use client";

import { useEffect } from "react";
import styles from "./search.module.scss";
import { getPackageDocs } from "../../../../client/api/get-package-docs";
import Loader from "../../../../client/components/Loader";
import Header from "../../../../client/components/Header";
import Footer from "../../../../client/components/Footer";
import { packageFromPath } from "../../../../common/utils";
import Error from "next/error";

export default function Search({ pkg }) {
  const pkgArray = Array.isArray(pkg) ? pkg : [pkg];

  if (!pkgArray.length) {
    return <Error statusCode={404} />;
  }

  const { packageName } = packageFromPath(pkgArray.join("/"));

  const searchAndRedirect = async (pkg: string) => {
    try {
      await getPackageDocs(pkg);
      window.location.href = `/docs/${pkg}/index.html`;
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearchSubmit = async (pkg: string) => {
    searchAndRedirect(pkg);
  };

  useEffect(() => {
    searchAndRedirect(pkg);
  }, []);

  return (
    <div className={styles.searchContainer}>
      <Header
        minimal={false}
        initialSearchValue={packageName}
        onSearchSubmit={handleSearchSubmit}
      />
      <div className={styles.searchPageLoaderContainer}>
        <Loader />
      </div>
      <Footer />
    </div>
  );
}
