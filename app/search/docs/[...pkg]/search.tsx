"use client";

import { useEffect, useState } from "react";
import styles from "./search.module.scss";
import {
  getPackageDocs,
  getPackageDocsSync,
} from "../../../../client/api/get-package-docs";
import Placeholder from "../../../../client/components/Placeholder";
import Header from "../../../../client/components/Header";
import Footer from "../../../../client/components/Footer";
import { packageFromPath } from "../../../../common/client-utils";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

export default function Search({ pkg }) {
  const pkgArray = Array.isArray(pkg) ? pkg : [pkg];
  const pkgPath = pkgArray.map(decodeURIComponent).join("/").split(/[#?]/)[0];

  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [error, setError] = useState<{
    errorCode: string;
    errorMessage: string;
  } | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const force = !!searchParams.get("force");
  const withForce = force ? "?force=true" : "";

  let packageName = "";
  let packageVersion = "";

  if (!pkgArray.length) {
    setStatus("error");
    setError({
      errorCode: "NO_PACKAGE_SPECIFIED",
      errorMessage: "No package name was specified",
    });
  }

  const pathFragments = packageFromPath(pkgPath);
  packageName = pathFragments.packageName;
  packageVersion = pathFragments.packageVersion;

  const searchAndRedirect = async (pkg: string, version: string | null) => {
    try {
      const result = await getPackageDocsSync(pkg, version, { force });

      if (result.status === "success") {
        window.location.href = `/docs/${
          version ? [pkg, version].join("/") : pkg
        }/index.html${withForce}`;
      } else {
        console.error("Getting package docs failed", result);
        setStatus("error");
        setError({
          errorMessage: result.errorMessage,
          errorCode: result.errorCode,
        });
      }
    } catch (err) {
      console.error("Getting package docs failed", err);
      setStatus("error");
      setError({
        errorMessage: "UNKNOWN_ERROR",
        errorCode: "Unexpected error when building the package",
      });
    }
  };

  const handleSearchSubmit = async (pkg: string) => {
    setStatus("loading");
    router.replace(`/search/docs/${pkg}${withForce}`);
    searchAndRedirect(pkg, null);
  };

  const handleVersionChange = async (version: string) => {
    router.replace(
      `/search/docs/${[packageName, version].join("/")}${withForce}`,
    );
    searchAndRedirect(pkg, version);
  };

  useEffect(() => {
    searchAndRedirect(packageName, packageVersion);
  }, []);

  return (
    <div className={styles.searchContainer}>
      <Header
        minimal={false}
        initialSearchValue={packageName}
        initialSearchVersion={packageVersion}
        onSearchSubmit={handleSearchSubmit}
        onVersionChange={handleVersionChange}
      />
      <div className={styles.searchPageLoaderContainer}>
        <Placeholder status={status} error={error} />
      </div>
      <Footer />
    </div>
  );
}
