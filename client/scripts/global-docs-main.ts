let start = Date.now();

function observeElement(
  root: HTMLElement,
  selector: string,
  callback: (element: Element) => void,
) {
  const observer = new MutationObserver((mutationsList, observer) => {
    // Look through all mutations that just occured
    for (let mutation of mutationsList) {
      // If the addedNodes property has one or more nodes
      if (mutation.addedNodes.length) {
        const element = root.querySelector(selector);
        if (element) {
          callback(element);
          observer.disconnect(); // Stop observing once element is found
          break;
        }
      }
    }
  });

  // Start observing the document with the configured parameters
  observer.observe(root, { childList: true, subtree: true });
}

function scrollNavigationIntoView() {
  console.log("Scrolling navigation into view");
  const matchedElement = (
    [...document.querySelectorAll(".tsd-navigation a")] as HTMLAnchorElement[]
  ).find((a: HTMLAnchorElement) => {
    return new URL(a.href).pathname === location.pathname;
  });

  matchedElement?.scrollIntoView();
}

document.addEventListener(
  "DOMContentLoaded",
  function () {
    observeElement(
      document.querySelector(".site-menu .tsd-navigation"),
      "li a",
      scrollNavigationIntoView,
    );
  },
  false,
);
