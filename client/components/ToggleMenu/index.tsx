import React, { useState, useEffect, useRef, useCallback } from "react";
import styles from "./ToggleMenu.module.scss";

interface HamburgerMenuProps {
  menuSelector: string;
  onToggle: (isOpen: boolean) => void;
}

const ToggleMenu: React.FC<HamburgerMenuProps> = ({
  menuSelector,
  onToggle,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = useCallback(() => {
    setIsOpen(!isOpen);
    onToggle(!isOpen);
  }, [isOpen, onToggle]);

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      const menu = document.querySelector(menuSelector);
      if (!menu.contains(event.target as Node)) {
        setIsOpen(false);
        onToggle(false);
      }
    },
    [onToggle],
  );

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [handleClickOutside]);

  return (
    <div>
      <button
        aria-label="Toggle menu"
        aria-expanded={isOpen}
        onClick={toggleMenu}
        className={styles.toggleButton}
      >
        <svg
          width="30"
          height="30"
          viewBox="0 0 100 80"
          fill="#000"
          aria-hidden={isOpen ? "true" : "false"}
        >
          <rect width="100" height="15"></rect>
          <rect y="30" width="100" height="15" rx="5px"></rect>
          <rect y="60" width="100" height="15" rx="5px"></rect>
        </svg>
      </button>
    </div>
  );
};

export default ToggleMenu;
