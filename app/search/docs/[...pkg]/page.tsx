import React from "react";
import Search from "./search";

const SearchPage = async ({
  params,
}: {
  params: Promise<{ pkg: string | string[] }>;
}) => {
  const { pkg } = await params;
  return <Search pkg={pkg} />;
};

export default SearchPage;
