import React from "react";
import { useCombobox } from "downshift";
import { getPackageSuggestion } from "../../../common/api/algolia";
import cx from "classnames";
import styles from "./SearchBox.module.scss";
import VersionDropdown from "./VersionDropdown";

type SearchBoxProps = {
  onSelect: (value: string) => void;
  onVersionChange?: (value: string) => void;
  initialValue?: string;
  initialVersion?: string;
  compact?: boolean;
  autoFocus?: boolean;
  showVersionDropdown?: boolean;
};

export default function SearchBox({
  onSelect,
  onVersionChange,
  showVersionDropdown,
  initialValue,
  initialVersion,
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
          setSuggestions(suggestions);
        }
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
        <div className={styles.inputWrapper}>
          <input
            placeholder="Search npm packages"
            className={styles.searchInput}
            spellCheck={false}
            {...getInputProps()}
            // prevent key hijack by typedoc search
            // https://github.com/pastelsky/tsdocs/issues/2
            onKeyDown={(...args) => {
              args[0].stopPropagation();
              return getInputProps().onKeyDown(...args);
            }}
            autoFocus={autoFocus}
          />
          {showVersionDropdown && initialVersion && (
            <VersionDropdown
              pkg={initialValue}
              initialVersion={initialVersion}
              onSelect={onVersionChange}
            />
          )}
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
