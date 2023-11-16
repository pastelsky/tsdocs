import React from "react";
import ReactDOM from "react-dom/client";
import Header from "../Header";
import "../../../pages/styles.css";
import styles from "./HeaderIframe.module.scss";
import { getPackageDocs } from "../../api/get-package-docs";
import { packageFromPath } from "../../../common/utils";

const HeaderIframe = () => {
  const { packageName: initialPackageName } = packageFromPath(
    window.location.pathname.split("/docs/")[1],
  );

  const handleSearchSubmit = async (pkg: string) => {
    window.location.pathname = `/docs/${pkg}`;
  };

  return (
    <div className={styles.docsHeaderContainer}>
      <Header
        minimal={false}
        initialSearchValue={initialPackageName}
        onSearchSubmit={handleSearchSubmit}
      />
    </div>
  );
};

document.addEventListener("DOMContentLoaded", (event) => {
  const rootElement = document.getElementById("docs-header");
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <HeaderIframe />
    </React.StrictMode>,
  );
});
