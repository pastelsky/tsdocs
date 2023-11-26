import React, { useEffect } from "react";
import Link from "next/link";

import styles from "./index.module.scss";

const allSuggestions = [
  "three",
  "execa",
  "globby",
  "solid-js",
  "playwright-core",
  "luxon",
  "redux",
  "lit",
  "@testing-library/react",
  "react-router-dom",
  "d3",
  "lodash-es",
];

function getRandomElements(array: string[], n: number) {
  let result = [];
  let taken = new Set();

  while (result.length < n && result.length < array.length) {
    let index = Math.floor(Math.random() * array.length);
    if (!taken.has(index)) {
      result.push(array[index]);
      taken.add(index);
    }
  }

  return result;
}

const SuggestionPills = () => {
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  useEffect(() => {
    setSuggestions(getRandomElements(allSuggestions, 4));
  }, []);

  return (
    <div className={styles.suggestionsPillsContainer}>
      {suggestions.map((suggestion) => (
        <Link
          className={styles.suggestionsPill}
          href={`/search/docs/${suggestion}`}
          key={suggestion}
        >
          <div>{suggestion}</div>
        </Link>
      ))}
    </div>
  );
};

export default SuggestionPills;
