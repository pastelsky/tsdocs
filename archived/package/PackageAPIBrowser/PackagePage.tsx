import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import axios from "axios";
import Viewer from "./Viewer";
import VersionSlider from "./VersionSlider";
import { getPackageVersions } from "../../../common/api/algolia";
import SearchBox from "../../../client/components/SearchBox";

const PackagePage = () => {
  const { query, pathname, isReady, push } = useRouter();

  console.log("pathname is ", { pathname });

  const packageName = Array.isArray(query.packageName)
    ? query.packageName.join("/")
    : query.packageName;

  console.log("query.packageName", query.packageName);

  const {
    isLoading: isPackageAPILoading,
    isError: isPackageAPIError,
    error: packageAPIError,
    data: packageAPIData,
  } = useQuery(["package-api", { packageName }], () =>
    axios.get(`/api/package?package=${packageName}`).then((res) => res.data),
  );

  const {
    isLoading: isPackageVersionsLoading,
    isError: isPackageVersionsError,
    error: packageVersionsError,
    data: packageVersionsData,
  } = useQuery(["package-versions", { packageName }], () =>
    getPackageVersions(packageName),
  );

  return (
    <div>
      <SearchBox onSelect={(item) => push(`/package/${item}`)} />
      {isPackageAPILoading && <div>Loading...</div>}
      {isPackageAPIError && (
        <div>Error... {JSON.stringify({ packageAPIError }, null, 2)}</div>
      )}
      {packageAPIData && <Viewer content={packageAPIData} />}
      {packageVersionsData && (
        <VersionSlider
          versions={packageVersionsData}
          includeMinor
          includePatch
        />
      )}
    </div>
  );
};

PackagePage.getInitialProps = async (ctx) => {
  return {};
};

export default PackagePage;
