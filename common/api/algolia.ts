import axios from "axios";
import semver from "semver";

const ALGOLIA_APP_ID = "OFCNCOG2CU";
const ALGOLIA_API_KEY = "1fb64b9fde1959aacbe82000a34dd717";

export async function getPackageVersions(packageName) {
  const packageDetails = await axios.get(
    `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/npm-search/${encodeURIComponent(
      packageName
    )}`,
    {
      params: {
        "x-algolia-application-id": ALGOLIA_APP_ID,
        "x-algolia-api-key": ALGOLIA_API_KEY,
      },
    }
  );
  return Object.keys(packageDetails.data.versions).map((version) =>
    semver.parse(version)
  );
}

export async function getPackageSuggestion(query: string, highlightClass) {
  const searchParams = {
    highlightPreTag: `<span class="${highlightClass}">`,
    highlightPostTag: "</span>",
    hitsPerPage: 5,
    page: 0,
    attributesToRetrieve: [
      "description",
      "homepage",
      "keywords",
      "name",
      "repository",
      "types",
      "version",
    ],
    attributesToHighlight: ["name", "description", "keywords"],
    query,
    maxValuesPerFacet: 10,
    facets: ["keywords", "keywords", "owner.name"],
  };

  const searchParamsStringified = Object.entries(searchParams)
    .map(([key, value]) => {
      const stringified = JSON.stringify(value);
      const strQuotedRemoved = stringified.substring(1, stringified.length - 1);
      return `${key}=${
        typeof value === "string" ? strQuotedRemoved : stringified
      }`;
    })
    .join("&");

  const urlParams = new URLSearchParams({
    "x-algolia-application-id": ALGOLIA_APP_ID,
    "x-algolia-api-key": ALGOLIA_API_KEY,
  });

  const suggestions = await axios({
    url: `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/*/queries?${urlParams.toString()}`,
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    data: JSON.stringify({
      requests: [
        {
          indexName: "npm-search",
          params: searchParamsStringified,
        },
      ],
    }),
  });

  const fixQuotes = (str) =>
    str
      ? str
          .replace(/\\"/g, '"')
          .replace(/"<span/g, "<span")
          .replace(/span>"/, "span>")
          .replace(/>"/g, ">")
          .replace(/"</g, "<")
      : str;

  return suggestions.data.results[0].hits.map((hit) => ({
    name: hit.name,
    description: hit.description,
    repository: hit.repository,
    types: hit.types,
    version: hit.version,
    highlightedName: fixQuotes(hit._highlightResult?.name?.value || hit.name),
    highlightedDescription: fixQuotes(
      hit._highlightResult?.description?.value || hit.description
    ),
  }));
}
