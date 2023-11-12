import React from "react";
import ReactDOM from "react-dom/client";
import Header from "../Header";
import "../../../pages/styles.css";
import styles from "./HeaderIframe.module.scss";
import { getPackageDocs } from "../../api/get-package-docs";

const HeaderIframe = () => {
  const handleSearchSubmit = async (pkg: string) => {
    try {
      await getPackageDocs(pkg);
      window.location.href = `/docs/${pkg}/index.html`;
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className={styles.docsHeaderContainer}>
      <Header
        minimal={false}
        initialSearchValue="foo"
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
