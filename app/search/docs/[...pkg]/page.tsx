import React from "react";
import Search from "./search";

const SearchPage = ({ params }: { params: { pkg: string | string[] } }) => {
  return <Search pkg={params.pkg} />;
};

export default SearchPage;
