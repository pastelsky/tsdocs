import React from "react";

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
        <a
          className={styles.suggestionsPill}
          href={`/docs/${suggestion}/index.html`}
        >
          <div>{suggestion}</div>
        </a>
      ))}
    </div>
  );
};

export default SuggestionPills;
