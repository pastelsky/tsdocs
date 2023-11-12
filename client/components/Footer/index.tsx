import React from "react";
import styles from "./Footer.module.scss";

const Footer = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerDescription}>
        <p>
          tsdocs.dev helps you browse reference typescript documentation for any
          package or version of a library.
        </p>
      </div>
      <div className={styles.footerCredits}>
        <div className={styles.footerCreditsInner}>
          Made with &nbsp;<span style={{ color: "white" }}>♥️</span>&nbsp; by
        </div>
        <a
          className="footer__credits-profile"
          target="_blank"
          href="https://github.com/pastelsky"
        >
          @pastelsky
        </a>
        <a target="_blank" href="https://github.com/pastelsky/tsdocs">
          <button className={styles.footerForkButton}>Star on GitHub</button>
        </a>
      </div>
    </footer>
  );
};

export default Footer;
