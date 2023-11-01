import React from "react";
import { useCombobox } from "downshift";
import { getPackageSuggestion } from "../../../common/api/algolia";
import cx from "classnames";
import styles from "./SearchBox.module.scss";

type SearchBoxProps = {
  onSelect: (value: string) => void;
};

export default function SearchBox({ onSelect }: SearchBoxProps) {
  const [suggestions, setSuggestions] = React.useState([]);

  const {
    isOpen,
    getToggleButtonProps,
    getLabelProps,
    getMenuProps,
    getInputProps,
    getComboboxProps,
    highlightedIndex,
    getItemProps,
    selectedItem,
  } = useCombobox({
    onSelectedItemChange: ({ selectedItem }) => {
      onSelect(selectedItem.name);
    },
    onInputValueChange({ inputValue }) {
      getPackageSuggestion(inputValue, styles.searchHighlight).then(
        (suggestions) => {
          console.log(suggestions);
          setSuggestions(suggestions);
        },
      );
    },
    items: suggestions,
    itemToString(item) {
      return item.name;
    },
  });
  return (
    <div className={styles.searchBox}>
      <div className={styles.comboBoxContainer}>
        <div {...getComboboxProps()}>
          <input
            placeholder="Search npm packages"
            className={styles.searchInput}
            spellCheck={false}
            {...getInputProps()}
          />
        </div>
      </div>
      <ul {...getMenuProps()} className={styles.searchSuggestionMenu}>
        {isOpen &&
          suggestions.map((item, index) => (
            <li key={`${item.name}${index}`} {...getItemProps({ item, index })}>
              <div
                className={styles.resultName}
                dangerouslySetInnerHTML={{ __html: item.highlightedName }}
              />
              <div
                className={styles.resultDescription}
                dangerouslySetInnerHTML={{
                  __html: item.highlightedDescription,
                }}
              />
            </li>
          ))}
      </ul>
    </div>
  );
}
