import React from "react";
import ReactDOM from "react-dom/client";
import Header from "../Header";
import "../../../app/global.css";
import styles from "./HeaderIframe.module.scss";
import { packageFromPath } from "../../../common/client-utils";
import ToggleMenu from "../ToggleMenu";
import "../../scripts/global-docs-main";

const HeaderIframe = () => {
  const searchParams = new URL(window.document.location.href).searchParams;

  const force = !!searchParams.get("force");

  const {
    packageName: initialPackageName,
    packageVersion: initialPackageVersion,
  } = packageFromPath(window.location.pathname.split("/docs/")[1]);

  const handleSearchSubmit = async (pkg: string) => {
    const withForce = force ? "?force=true" : "";
    window.location.pathname = `/search/docs/${pkg}${withForce}`;
  };

  const handleVersionChange = async (version: string) => {
    const withForce = force ? "?force=true" : "";
    window.location.pathname = `/search/docs/${[
      initialPackageName,
      version,
    ].join("/")}${withForce}`;
  };

  const handleMenuToggle = (open: boolean) => {
    if (open) {
      document.documentElement.classList.add("has-menu");
    } else {
      document.documentElement.classList.remove("has-menu");
    }
  };

  return (
    <div className={styles.docsHeaderContainer}>
      <Header
        minimal={false}
        initialSearchValue={initialPackageName}
        initialSearchVersion={initialPackageVersion}
        onSearchSubmit={handleSearchSubmit}
        onVersionChange={handleVersionChange}
        linksSection={
          <div className={styles.docsHeaderToggle}>
            <ToggleMenu
              onToggle={handleMenuToggle}
              menuSelector=".col-sidebar"
            />
          </div>
        }
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
