import React from "react";
import Link from "next/link";

import styles from "./index.module.scss";

const suggestions = [
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
];

function shuffleArray(array: any[]): any[] {
  let currentDate = new Date();
  let currentHour = currentDate.getHours();

  return array.sort(() => 0.5 - Math.sin(currentHour));
}

const SuggestionPills = () => {
  const randomSuggestions = shuffleArray(suggestions).slice(0, 4);
  console.log(randomSuggestions);
  return (
    <div className={styles.suggestionsPillsContainer}>
      {randomSuggestions.map((suggestion) => (
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
