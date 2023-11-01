import React, { SyntheticEvent, useEffect, useRef, useState } from "react";
import styles from "./VersionSlider.module.scss";
import cx from "classnames";
import { getPackageVersions } from "../../../../common/api/getPackageVersions";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import semver, { SemVer } from "semver";
import debounce from "debounce";
import { useHotkeys } from "react-hotkeys-hook";

const VersionCell = ({
  version,
  isSelected,
  onSelect,
}: {
  version: SemVer;
  isSelected: boolean;
  onSelect: (
    version: string,
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) => void;
}) => {
  const versionCellRef = useRef(null);

  useEffect(() => {
    if (isSelected) {
      versionCellRef.current.focus({ preventScroll: true });
      // versionCellRef.current.scrollIntoView({
      //   behavior: "smooth",
      //   inline: "center",
      // });
    }
  }, [isSelected]);

  return (
    <li
      className={cx(styles.versionCell, {
        [styles.versionCellSelected]: isSelected,
      })}
    >
      <button ref={versionCellRef} onClick={(e) => onSelect(version, e)}>
        {version.major}
        <span className={styles.dimmed}>.</span>
        {version.minor}
        <span className={styles.dimmed}>.</span>
        {version.patch}
        {version.prerelease.length > 0 && "-"}
        {version.prerelease.join(".")}
      </button>
    </li>
  );
};

const sumAll = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

const VersionSlider = ({
  selectedVersion,
  versions,
  includePrerelease = false,
  includePatch = false,
  includeMinor = false,
}: {
  selectedVersion?: string;
  versions: SemVer[];
  includePrerelease: boolean;
  includePatch: boolean;
  includeMinor: boolean;
}) => {
  const filteredVersions = versions
    .sort((versionA, versionB) => semver.compare(versionA, versionB))
    .filter((version, index) => {
      if (!includePrerelease && version.prerelease.length) {
        return false;
      }

      if (
        !includePatch &&
        version.minor === versions[index + 1]?.minor &&
        version.major === versions[index + 1]?.major
      ) {
        return false;
      }

      if (!includeMinor && version.major === versions[index + 1]?.major) {
        return false;
      }

      return true;
    });

  const initialSelected =
    semver.parse(selectedVersion) ||
    filteredVersions[filteredVersions.length - 1];
  const [selected, setSelected] = useState<SemVer>(initialSelected);
  const versionListRef = useRef(null);
  const versionCellContentRef = useRef(null);
  const midpointsRef = useRef([]);
  const isScrolling = useRef(false);
  let scrollTimer = useRef(null);
  let isClickScroll = useRef(false);
  let isDrag = useRef(false);
  const selectedStateRef = useRef(selected);

  let widthMeasurements = [];

  const getClosestMid = (scrollX: number) => {
    const { current: midpoints } = midpointsRef;
    if (!midpoints.length) return 0;
    if (scrollX <= midpoints[0]) return 0;
    if (scrollX >= midpoints[midpoints.length - 1]) return midpoints.length - 1;
    return midpoints.findIndex((midpoint) => midpoint >= scrollX);
  };

  useEffect(() => {
    widthMeasurements = [
      ...versionListRef.current.querySelectorAll(`.${styles.versionCell}`),
    ].map((element) => element.scrollWidth);

    let tempMidpoints = [];
    widthMeasurements.forEach((width, index) => {
      tempMidpoints.push(sumAll(widthMeasurements.slice(0, index + 1)));
    });

    midpointsRef.current = tempMidpoints;
  }, [includePrerelease]);

  useHotkeys("left", (...args) => {
    const currentIndex = filteredVersions.findIndex(
      (v) => v === selectedStateRef.current,
    );
    console.log("left", currentIndex);
    if (currentIndex > 0) {
      isClickScroll.current = true;
      setSelected(filteredVersions[currentIndex - 1]);
      selectedStateRef.current = filteredVersions[currentIndex - 1];
    }
  });

  useHotkeys("right", (...args) => {
    const currentIndex = filteredVersions.findIndex(
      (v) => v === selectedStateRef.current,
    );
    console.log("right", currentIndex);
    if (currentIndex < filteredVersions.length - 1) {
      isClickScroll.current = true;
      setSelected(filteredVersions[currentIndex + 1]);
      selectedStateRef.current = filteredVersions[currentIndex + 1];
    }
  });

  const handleVersionSelect = (
    version,
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) => {
    isClickScroll.current = true;
    setSelected(version);
    selectedStateRef.current = version;

    e.target.scrollIntoView({
      behavior: "smooth",
      inline: "center",
    });
  };

  const handleSlide = (event) => {
    const onScrollStop = () => {
      console.log("setting scroll to false");
      isClickScroll.current = false;
      isScrolling.current = false;

      const closestIndex = getClosestMid(event.target.scrollLeft);
      console.log(
        "closestIndex is ",
        closestIndex,
        filteredVersions.length,
        filteredVersions[closestIndex],
      );

      if (closestIndex === -1) {
        console.error("invalid index", event.target.scrollLeft);
      }

      setSelected(filteredVersions[closestIndex]);
      selectedStateRef.current = filteredVersions[closestIndex];
    };

    console.log("scrolling");
    if (!isScrolling.current) {
      scrollTimer.current = setTimeout(onScrollStop, 100);
      isScrolling.current = true;
    } else {
      clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(onScrollStop, 100);
    }
  };

  let pos;

  const handleMouseUp = () => {
    if (!pos) return;
    const offset = versionCellContentRef.current.style.transform.match(
      /translateX\(([\d.]+)px\)/,
    );

    if (offset && offset[1])
      versionListRef.current.scrollTo({
        left: pos.left - offset[1],
        behaviour: "smooth",
      });
    versionCellContentRef.current.style.transform = "none";

    versionListRef.current.style.cursor = "initial";
    console.log("mouse up", versionCellContentRef.current.style.transform);
    pos = null;
  };

  const handleMouseMove = (e) => {
    if (!pos) return;
    versionListRef.current.style.cursor = "grabbing";
    const dx = e.clientX - pos.x;
    console.log("mouse moving...", dx);
    isDrag.current = true;

    // Scroll the element
    versionCellContentRef.current.style.transform = "translateX(" + dx + "px)";
  };

  const handleMouseDown = (e) => {
    console.log("mouse down");
    versionListRef.current.style.cursor = "grab";
    pos = {
      // The current scroll
      left: e.currentTarget.scrollLeft,
      // Get the current mouse position
      x: e.clientX,
    };

    console.log("set current pos to ", pos);
  };

  return (
    <div className={styles.versionSlider} onPointerOut={handleMouseUp}>
      <div className={styles.versionLabel}>Version</div>
      <ul
        ref={versionListRef}
        className={styles.versionCellContainer}
        onScroll={handleSlide}
        onPointerUp={handleMouseUp}
        onPointerMove={handleMouseMove}
        onPointerDown={handleMouseDown}
      >
        <div className={styles.versionCellContent} ref={versionCellContentRef}>
          {filteredVersions.map((version, index) => (
            <VersionCell
              key={version.version}
              version={version}
              isSelected={semver.eq(version, selected)}
              onSelect={handleVersionSelect}
            />
          ))}
        </div>
      </ul>
      <div className={styles.versionPointer} />
    </div>
  );
};

export default VersionSlider;
