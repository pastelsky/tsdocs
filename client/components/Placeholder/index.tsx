import React from "react";
import cx from "classnames";
import styles from "./Placeholder.module.scss";
import Toaster from "../Toaster";

const Loader = ({
  status,
  error,
}: {
  status: "loading" | "error";
  error?: {
    errorCode: string;
    errorMessage: string;
  };
}) => {
  return (
    <div
      className={cx(styles.placeholderContainer, {
        [styles.placeholderLoader]: status === "loading",
        [styles.placeholderError]: status === "error",
      })}
    >
      <div className={styles.toaster}>
        <Toaster status={status} />
      </div>

      {status === "loading" && (
        <div className={styles.label}>Baking reference docs...</div>
      )}

      {status === "error" && (
        <div className={styles.label}>
          <code>{error.errorCode}</code>
          <p>{error.errorMessage}</p>
        </div>
      )}
    </div>
  );
};

export default Loader;
