import { useSelect } from "downshift";
import React from "react";
import semver from "semver";
import styles from "./SearchBox.module.scss";
import { getPackageVersions } from "../../../common/api/algolia";
import { ChevronDown, ChevronUp } from "./Chevron";

export default function VersionDropdown({
  pkg,
  initialVersion,
  onSelect,
}: {
  pkg: string;
  initialVersion: string;
  onSelect: (value: string) => void;
}) {
  const [versions, setVersions] = React.useState([]);

  React.useEffect(() => {
    getPackageVersions(pkg).then((versions) => {
      setVersions(
        versions
          .filter((v) => semver.valid(v) && !semver.prerelease(v))
          .map((v) => v.version)
          .sort(semver.compare),
      );
    });
  }, []);

  function itemToString(item) {
    return item ? item.title : "";
  }

  const versionItems = versions.map((v) => ({ id: v, title: v }));

  function Select() {
    const {
      isOpen,
      selectedItem,
      getToggleButtonProps,
      getLabelProps,
      getMenuProps,
      highlightedIndex,
      getItemProps,
    } = useSelect({
      items: versionItems,
      itemToString,
      initialSelectedItem: versionItems.find((v) => v.id === initialVersion),
      onSelectedItemChange: (changes) => {
        onSelect(changes.selectedItem.id);
      },
    });

    return (
      <div className={styles.versionDropdown}>
        <div>
          <div
            {...getToggleButtonProps()}
            className={styles.versionDropdownToggle}
          >
            <span className={styles.versionDropdownLabel}>v</span>
            {selectedItem?.title || initialVersion}
            {isOpen ? <ChevronUp /> : <ChevronDown />}
          </div>
        </div>
        <ul className={styles.versionMenu} {...getMenuProps()}>
          {isOpen &&
            versionItems.map((item, index) => (
              <li key={item.id} {...getItemProps({ item, index })}>
                <span>{item.title}</span>
              </li>
            ))}
        </ul>
      </div>
    );
  }

  return <Select />;
}
