import React from "react";
import styles from "./Loader.module.scss";

const Loader = () => {
  return (
    <div className={styles.loader}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 65 52"
        style={{ width: "97px", height: "auto" }}
      >
        <path
          fill="#555B6C"
          d="M33.85 52h-1.27H34h-.15s3.04-4 5.65-4h25V0h-25a8 8 0 0 0-6.92 4h-.16a8 8 0 0 0-6.92-4H.5v48h25c1.1 0 5.65 2.9 5.65 4H34h-.5.35ZM2.5 2h23a6 6 0 0 1 6 6v38h2V8a6 6 0 0 1 6-6h23v44h-23a8 8 0 0 0-7 4.14 8 8 0 0 0-7-4.14h-23V2Z"
        />
        <path
          fill="#555B6C"
          d="M28 10H10v2h18v-2ZM28 15H10v2h18v-2ZM28 20H10v2h18v-2ZM28 25H10v2h18v-2ZM28 30H10v2h18v-2ZM28 35H10v2h18v-2ZM56 10H38v2h18v-2ZM56 15H38v2h18v-2ZM56 20H38v2h18v-2ZM56 25H38v2h18v-2ZM56 30H38v2h18v-2ZM56 35H38v2h18v-2Z"
        />
      </svg>
      <div className={styles.label}>Building docs...</div>
    </div>
  );
};

export default Loader;
