import React from "react";
import styles from "./Loader.module.scss";
import Toaster from "../Toaster";

const Loader = () => {
  return (
    <div className={styles.loader}>
      <div className={styles.toaster}>
        <Toaster status="loading" />
      </div>
      <div className={styles.label}>Baking reference docs...</div>
    </div>
  );
};

export default Loader;
