import React from "react";

export const ChevronDown = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>((props, ref) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      fill="currentColor"
      viewBox="0 0 16 16"
      style={{ marginLeft: "5px", marginTop: "2px" }}
    >
      <path
        fillRule="evenodd"
        fill="#ccc"
        stroke="#ccc"
        strokeWidth="0.5px"
        d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"
      />
    </svg>
  );
});

export const ChevronUp = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>((props, ref) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      fill="currentColor"
      viewBox="0 0 16 16"
      style={{ marginLeft: "5px", marginTop: "2px" }}
    >
      <path
        fill-rule="evenodd"
        fill="var(--separator-color)"
        stroke="var(--separator-color)"
        strokeWidth="0.5px"
        d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z"
      />
    </svg>
  );
});
