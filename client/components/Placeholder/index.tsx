import React from "react";
import cx from "classnames";
import styles from "./Placeholder.module.scss";
import Toaster from "../Toaster";

const Placeholder = ({
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
        <div className={styles.label}>
          Installing package and extracting docs...
        </div>
      )}

      {status === "error" && (
        <div className={styles.label}>
          <code className={styles.errorCode}>{error.errorCode}</code>
          <p
            className={styles.errorMessage}
            dangerouslySetInnerHTML={{ __html: error.errorMessage }}
          />
        </div>
      )}
    </div>
  );
};

export default Placeholder;
