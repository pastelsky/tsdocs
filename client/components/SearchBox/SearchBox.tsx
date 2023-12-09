import React from "react";
import { useCombobox } from "downshift";
import { getPackageSuggestion } from "../../../common/api/algolia";
import cx from "classnames";
import styles from "./SearchBox.module.scss";

type SearchBoxProps = {
  onSelect: (value: string) => void;
  initialValue?: string;
  compact?: boolean;
  autoFocus?: boolean;
};

export default function SearchBox({
  onSelect,
  initialValue,
  compact,
  autoFocus,
}: SearchBoxProps) {
  const [suggestions, setSuggestions] = React.useState([]);

  const stateReducer = React.useCallback((state, actionAndChanges) => {
    const { type, changes } = actionAndChanges;
    switch (type) {
      case useCombobox.stateChangeTypes.InputKeyDownEnter:
        onSelect(state.inputValue);
      default:
        return changes;
    }
  }, []);

  const {
    isOpen,
    getToggleButtonProps,
    getLabelProps,
    getMenuProps,
    getInputProps,
    highlightedIndex,
    getItemProps,
    selectedItem,
  } = useCombobox({
    initialInputValue: initialValue,
    onSelectedItemChange: ({ selectedItem }) => {
      onSelect(selectedItem.name);
    },
    stateReducer,
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
    <div
      className={cx(styles.searchBox, { [styles.searchBoxCompact]: compact })}
    >
      <div className={styles.comboBoxContainer}>
        <div>
          <input
            placeholder="Search npm packages"
            className={styles.searchInput}
            spellCheck={false}
            {...getInputProps()}
            autoFocus={autoFocus}
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
