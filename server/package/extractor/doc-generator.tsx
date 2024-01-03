import * as td from "typedoc";
import {
  Application,
  DefaultTheme,
  DefaultThemeRenderContext,
  PageEvent,
  ProjectReflection,
  Reflection,
  ReflectionKind,
  ReflectionSymbolId,
  Renderer,
  TypeDocOptions,
} from "typedoc";
import path from "path";
import logger from "../../../common/logger";
import { generateTSConfig } from "./generate-tsconfig";
import { docsVersion, getDocsPath } from "../utils";
import { TypeDefinitionResolveError, TypeDocBuildError } from "../CustomError";
import InstallationUtils from "../installation.utils";
import { JSX, Serializer } from "typedoc";
import { load as loadMissingExportsPlugin } from "./plugin-add-missing-exports";

import {
  TypeResolveResult,
  resolveTypePathDefinitelyTyped,
  resolveTypePathInbuilt,
} from "../resolvers";
import fs from "fs";
import { transformCommonJSExport } from "./augment-extract";
import { DocsCache } from "../DocsCache";
import { installQueue, installQueueEvents } from "../../queues";

class CustomThemeContext extends DefaultThemeRenderContext {
  _originalNav: any;

  public constructor(theme, page, options) {
    super(theme, page, options);
    this._originalNav = this.navigation(page);
    this.navigation = (page) =>
      JSX.createElement("div", {}, [
        JSX.createElement(JSX.Raw, {
          html: `
            <div id="tsd-search" data-base="${this.relativeURL("./")}">
                <input type="text" aria-label="Search" placeholder="Search within library"/>
                <ul class="results">
                    <li class="state loading">Preparing search index...</li>
                    <li class="state failure">The search index is not available</li>
                </ul>
            </div>
`,
        }),
        this._originalNav,
      ]);
  }

  override toolbar = (context) => {
    return JSX.createElement(JSX.Raw, {
      html: ``,
    });
  };
}

export class CustomTheme extends DefaultTheme {
  private _contextCache?: CustomThemeContext;

  public override getRenderContext(
    page: PageEvent<Reflection>,
  ): CustomThemeContext {
    this._contextCache ||= new CustomThemeContext(
      this,
      page,
      this.application.options,
    );

    return new CustomThemeContext(this, page, this.application.options);
  }
}

const makeExternalsGlobPattern = (packageName) => {
  const fragments = packageName.split("/");

  if (packageName.startsWith("@")) {
    return [
      `**/node_modules/!(${fragments[0]})/${fragments[1]}/**`,
      `**/node_modules/${fragments[0]}/!(${fragments[1]})/**`,
    ];
  }

  return [`**/node_modules/!(${packageName})/**`];
};
const generateDocsDefaultOptions = (
  packageName: string,
): Partial<TypeDocOptions> => ({
  excludeExternals: false,
  externalPattern: makeExternalsGlobPattern(packageName),
  excludeNotDocumented: false,
  excludeInternal: true,
  excludePrivate: false,
  excludeProtected: false,
  excludeReferences: false,
  excludeCategories: [],
  includeVersion: true,
  disableSources: true,
  disableGit: true,
  //  readme: "none",
  stripYamlFrontmatter: true,
  pretty: true,
  emit: "docs",
  githubPages: false,
  hideGenerator: true,
  hideParameterTypesInTitle: true,
  searchInComments: true,
  cleanOutputDir: true,
  skipErrorChecking: true,
  visibilityFilters: {
    protected: false,
    private: false,
    inherited: true,
    external: true,
  },
  groupOrder: [
    "Classes",
    "Functions",
    "Variables",
    "Type Aliases",
    "Interfaces",
    "Modules",
    "Namespaces",
  ],
  customCss: path.join(__dirname, "./css-overrides.css"),
  navigation: {
    includeCategories: true,
    includeGroups: true,
  },
  useTsLinkResolution: true,
  categorizeByGroup: true,
  sourceLinkTemplate: `https://unpkg.com/browse/{path}`,

  //    name: string;
  //    gitRevision: string;
  //    gitRemote: string;
  //    gaID: string;
  theme: "tsdocs",
  lightHighlightTheme: "light-plus",
  darkHighlightTheme: "light-plus",
  logLevel: "Error",
  //    markedOptions: unknown;
  //    titleLink: string;
  //    navigationLinks: ManuallyValidatedOption<Record<string, string>>;
  //    sidebarLinks: ManuallyValidatedOption<Record<string, string>>;
  //    navigationLeaves: string[];

  //    searchCategoryBoosts: ManuallyValidatedOption<Record<string, number>>;
  //    searchGroupBoosts: ManuallyValidatedOption<Record<string, number>>;
  //    commentStyle: typeof CommentStyle;
  //    preserveLinkText: boolean;
  //    jsDocCompatibility: JsDocCompatibility;
  //    blockTags: `@${string}`[];
  //    inlineTags: `@${string}`[];
  //    modifierTags: `@${string}`[];
  //    excludeTags: `@${string}`[];
  //    externalSymbolLinkMappings: ManuallyValidatedOption<Record<string, Record<string, string>>>;
  //    media: string;
  //    includes: string;
  //    defaultCategory: string;
  //    categoryOrder: string[];

  //    sort: SortStrategy[];
  //    sortEntryPoints: boolean;
  //    kindSortOrder: ReflectionKind.KindString[];
  //    treatWarningsAsErrors: boolean;
  //    treatValidationWarningsAsErrors: boolean;
  //    intentionallyNotExported: string[];
  //    validation: ValidationOptions;
  //    requiredToBeDocumented: ReflectionKind.KindString[];
  //    watch: boolean;
  //    preserveWatchOutput: boolean;
  //    help: boolean;
  //    version: boolean;
  //    showConfig: boolean;
});

async function generateDocsHTML(
  app: td.Application,
  project: ProjectReflection,
) {
  const generateTimer = logger.startTimer();
  await app.generateDocs(project, app.options.getValue("out"));
  generateTimer.done({ message: `generated html docs` });
}

const iconColors = {
  [ReflectionKind.Class]: {
    background: "var(--color-ts-class-background)",
    foreground: "var(--color-ts-class)",
    path: "M22.153 16.1V9.107h1.271l.125 1.043h.069c.184-.338.47-.625.856-.86.387-.235.834-.352 1.34-.352.839 0 1.47.258 1.893.775.424.517.636 1.278.636 2.284V16.1h-1.465v-3.92c0-.582-.12-1.034-.359-1.353-.24-.32-.617-.48-1.133-.48-.506 0-.93.174-1.27.522-.332.348-.498.85-.498 1.509V16.1h-1.465Zm-5.825.17c-.829 0-1.46-.258-1.893-.775-.423-.527-.635-1.288-.635-2.284V9.107h1.464v3.92c0 .574.12 1.025.36 1.354.248.32.626.48 1.132.48.507 0 .93-.175 1.271-.523.341-.347.511-.85.511-1.508V9.107h1.465v6.994h-1.271l-.124-1.043h-.07c-.184.338-.47.625-.856.86-.387.235-.838.352-1.354.352ZM5.46 19.203v-1.311h1.12c.322 0 .553-.07.69-.212.148-.131.222-.357.222-.676v-6.627h-1.74v-1.27h1.74v-.972c0-.78.189-1.34.566-1.678.378-.339.917-.508 1.617-.508h1.671v1.312H9.854c-.322 0-.552.065-.69.197-.139.132-.208.362-.208.69v.96h2.39v1.269h-2.39v6.64c0 .78-.189 1.34-.566 1.679-.378.338-.921.507-1.63.507h-1.3Z",
  },
  [ReflectionKind.Function]: {
    background: "var(--color-ts-function-background)",
    foreground: "var(--color-ts-function)",
    path: "M22.153 16.1V9.107h1.271l.125 1.043h.069c.184-.338.47-.625.856-.86.387-.235.834-.352 1.34-.352.839 0 1.47.258 1.893.775.424.517.636 1.278.636 2.284V16.1h-1.465v-3.92c0-.582-.12-1.034-.359-1.353-.24-.32-.617-.48-1.133-.48-.506 0-.93.174-1.27.522-.332.348-.498.85-.498 1.509V16.1h-1.465Zm-5.825.17c-.829 0-1.46-.258-1.893-.775-.423-.527-.635-1.288-.635-2.284V9.107h1.464v3.92c0 .574.12 1.025.36 1.354.248.32.626.48 1.132.48.507 0 .93-.175 1.271-.523.341-.347.511-.85.511-1.508V9.107h1.465v6.994h-1.271l-.124-1.043h-.07c-.184.338-.47.625-.856.86-.387.235-.838.352-1.354.352ZM5.46 19.203v-1.311h1.12c.322 0 .553-.07.69-.212.148-.131.222-.357.222-.676v-6.627h-1.74v-1.27h1.74v-.972c0-.78.189-1.34.566-1.678.378-.339.917-.508 1.617-.508h1.671v1.312H9.854c-.322 0-.552.065-.69.197-.139.132-.208.362-.208.69v.96h2.39v1.269h-2.39v6.64c0 .78-.189 1.34-.566 1.679-.378.338-.921.507-1.63.507h-1.3Z",
  },
  [ReflectionKind.Enum]: {
    background: "var(--color-ts-enum-background)",
    foreground: "var(--color-ts-enum)",
    path: "M22.153 16.1V9.107h1.271l.125 1.043h.069c.184-.338.47-.625.856-.86.387-.235.834-.352 1.34-.352.839 0 1.47.258 1.893.775.424.517.636 1.278.636 2.284V16.1h-1.465v-3.92c0-.582-.12-1.034-.359-1.353-.24-.32-.617-.48-1.133-.48-.506 0-.93.174-1.27.522-.332.348-.498.85-.498 1.509V16.1h-1.465Zm-5.825.17c-.829 0-1.46-.258-1.893-.775-.423-.527-.635-1.288-.635-2.284V9.107h1.464v3.92c0 .574.12 1.025.36 1.354.248.32.626.48 1.132.48.507 0 .93-.175 1.271-.523.341-.347.511-.85.511-1.508V9.107h1.465v6.994h-1.271l-.124-1.043h-.07c-.184.338-.47.625-.856.86-.387.235-.838.352-1.354.352ZM5.46 19.203v-1.311h1.12c.322 0 .553-.07.69-.212.148-.131.222-.357.222-.676v-6.627h-1.74v-1.27h1.74v-.972c0-.78.189-1.34.566-1.678.378-.339.917-.508 1.617-.508h1.671v1.312H9.854c-.322 0-.552.065-.69.197-.139.132-.208.362-.208.69v.96h2.39v1.269h-2.39v6.64c0 .78-.189 1.34-.566 1.679-.378.338-.921.507-1.63.507h-1.3Z",
  },
  [ReflectionKind.Interface]: {
    background: "var(--color-ts-interface-background)",
    foreground: "var(--color-ts-interface)",
    path: "M22.153 16.1V9.107h1.271l.125 1.043h.069c.184-.338.47-.625.856-.86.387-.235.834-.352 1.34-.352.839 0 1.47.258 1.893.775.424.517.636 1.278.636 2.284V16.1h-1.465v-3.92c0-.582-.12-1.034-.359-1.353-.24-.32-.617-.48-1.133-.48-.506 0-.93.174-1.27.522-.332.348-.498.85-.498 1.509V16.1h-1.465Zm-5.825.17c-.829 0-1.46-.258-1.893-.775-.423-.527-.635-1.288-.635-2.284V9.107h1.464v3.92c0 .574.12 1.025.36 1.354.248.32.626.48 1.132.48.507 0 .93-.175 1.271-.523.341-.347.511-.85.511-1.508V9.107h1.465v6.994h-1.271l-.124-1.043h-.07c-.184.338-.47.625-.856.86-.387.235-.838.352-1.354.352ZM5.46 19.203v-1.311h1.12c.322 0 .553-.07.69-.212.148-.131.222-.357.222-.676v-6.627h-1.74v-1.27h1.74v-.972c0-.78.189-1.34.566-1.678.378-.339.917-.508 1.617-.508h1.671v1.312H9.854c-.322 0-.552.065-.69.197-.139.132-.208.362-.208.69v.96h2.39v1.269h-2.39v6.64c0 .78-.189 1.34-.566 1.679-.378.338-.921.507-1.63.507h-1.3Z",
  },
  [ReflectionKind.Namespace]: {
    background: "var(--color-ts-namespace-background)",
    foreground: "var(--color-ts-namespace)",
    path: "M22.153 16.1V9.107h1.271l.125 1.043h.069c.184-.338.47-.625.856-.86.387-.235.834-.352 1.34-.352.839 0 1.47.258 1.893.775.424.517.636 1.278.636 2.284V16.1h-1.465v-3.92c0-.582-.12-1.034-.359-1.353-.24-.32-.617-.48-1.133-.48-.506 0-.93.174-1.27.522-.332.348-.498.85-.498 1.509V16.1h-1.465Zm-5.825.17c-.829 0-1.46-.258-1.893-.775-.423-.527-.635-1.288-.635-2.284V9.107h1.464v3.92c0 .574.12 1.025.36 1.354.248.32.626.48 1.132.48.507 0 .93-.175 1.271-.523.341-.347.511-.85.511-1.508V9.107h1.465v6.994h-1.271l-.124-1.043h-.07c-.184.338-.47.625-.856.86-.387.235-.838.352-1.354.352ZM5.46 19.203v-1.311h1.12c.322 0 .553-.07.69-.212.148-.131.222-.357.222-.676v-6.627h-1.74v-1.27h1.74v-.972c0-.78.189-1.34.566-1.678.378-.339.917-.508 1.617-.508h1.671v1.312H9.854c-.322 0-.552.065-.69.197-.139.132-.208.362-.208.69v.96h2.39v1.269h-2.39v6.64c0 .78-.189 1.34-.566 1.679-.378.338-.921.507-1.63.507h-1.3Z",
  },
  [ReflectionKind.TypeAlias]: {
    background: "var(--color-ts-type-alias-background)",
    foreground: "var(--color-ts-type-alias)",
    path: "M22.153 16.1V9.107h1.271l.125 1.043h.069c.184-.338.47-.625.856-.86.387-.235.834-.352 1.34-.352.839 0 1.47.258 1.893.775.424.517.636 1.278.636 2.284V16.1h-1.465v-3.92c0-.582-.12-1.034-.359-1.353-.24-.32-.617-.48-1.133-.48-.506 0-.93.174-1.27.522-.332.348-.498.85-.498 1.509V16.1h-1.465Zm-5.825.17c-.829 0-1.46-.258-1.893-.775-.423-.527-.635-1.288-.635-2.284V9.107h1.464v3.92c0 .574.12 1.025.36 1.354.248.32.626.48 1.132.48.507 0 .93-.175 1.271-.523.341-.347.511-.85.511-1.508V9.107h1.465v6.994h-1.271l-.124-1.043h-.07c-.184.338-.47.625-.856.86-.387.235-.838.352-1.354.352ZM5.46 19.203v-1.311h1.12c.322 0 .553-.07.69-.212.148-.131.222-.357.222-.676v-6.627h-1.74v-1.27h1.74v-.972c0-.78.189-1.34.566-1.678.378-.339.917-.508 1.617-.508h1.671v1.312H9.854c-.322 0-.552.065-.69.197-.139.132-.208.362-.208.69v.96h2.39v1.269h-2.39v6.64c0 .78-.189 1.34-.566 1.679-.378.338-.921.507-1.63.507h-1.3Z",
  },
  [ReflectionKind.Variable]: {
    background: "var(--color-ts-variable-background)",
    foreground: "var(--color-ts-variable)",
    path: "M22.153 16.1V9.107h1.271l.125 1.043h.069c.184-.338.47-.625.856-.86.387-.235.834-.352 1.34-.352.839 0 1.47.258 1.893.775.424.517.636 1.278.636 2.284V16.1h-1.465v-3.92c0-.582-.12-1.034-.359-1.353-.24-.32-.617-.48-1.133-.48-.506 0-.93.174-1.27.522-.332.348-.498.85-.498 1.509V16.1h-1.465Zm-5.825.17c-.829 0-1.46-.258-1.893-.775-.423-.527-.635-1.288-.635-2.284V9.107h1.464v3.92c0 .574.12 1.025.36 1.354.248.32.626.48 1.132.48.507 0 .93-.175 1.271-.523.341-.347.511-.85.511-1.508V9.107h1.465v6.994h-1.271l-.124-1.043h-.07c-.184.338-.47.625-.856.86-.387.235-.838.352-1.354.352ZM5.46 19.203v-1.311h1.12c.322 0 .553-.07.69-.212.148-.131.222-.357.222-.676v-6.627h-1.74v-1.27h1.74v-.972c0-.78.189-1.34.566-1.678.378-.339.917-.508 1.617-.508h1.671v1.312H9.854c-.322 0-.552.065-.69.197-.139.132-.208.362-.208.69v.96h2.39v1.269h-2.39v6.64c0 .78-.189 1.34-.566 1.679-.378.338-.921.507-1.63.507h-1.3Z",
  },
};

iconColors[ReflectionKind.CallSignature] = iconColors[ReflectionKind.Function];
iconColors[ReflectionKind.TypeLiteral] = iconColors[ReflectionKind.TypeAlias];
iconColors[ReflectionKind.TypeParameter] = iconColors[ReflectionKind.TypeAlias];
iconColors[ReflectionKind.Module] = iconColors[ReflectionKind.Namespace];
iconColors[ReflectionKind.Project] = iconColors[ReflectionKind.Namespace];
iconColors[ReflectionKind.Method] = iconColors[ReflectionKind.Function];

function setupApp(app: td.Application) {
  if (app["setupComplete"]) {
    return;
  }

  app["setupComplete"] = true;

  loadMissingExportsPlugin(app);

  app.renderer.hooks.on("head.begin", () =>
    JSX.createElement(JSX.Raw, {
      html: `
         <link rel="stylesheet" href="/shared-dist/style.css" fetchpriority="high" />
         <script src="/shared-dist/header.umd.js" fetchpriority="high" defer></script>
         <style>
           ${Object.entries(iconColors)
             .map(([id, { background, foreground, path }]) => {
               return `
                 #icon-${id} rect {
                   fill: ${background};
                 }
           
                 #icon-${id} path {
                    fill: ${foreground};
                    stroke: ${foreground};
                 }
           `;
             })
             .join("\n")}
          </style>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital@0;1&display=swap" rel="stylesheet">
      `,
    }),
  );

  app.renderer.hooks.on("body.begin", () =>
    JSX.createElement(JSX.Raw, {
      html: `
        <div id="docs-header"></div>
        <script>
          !function(t,e,n){if(!("Set"in window))return;const r="instantVaryAccept"in t.body.dataset||"Shopify"in window;let i;const o=navigator.userAgent.indexOf("Chrome/");if(o>-1&&(i=parseInt(navigator.userAgent.substring(o+7))),r&&i&&i<110)return;const s=t.createElement("link"),a=t.head;a.appendChild(s);const c=new Set;let l=0,d=0,u=s.relList;const f=void 0!==u&&void 0!==u.supports,h=f&&u.supports("prerender"),p=!f||u.supports("prefetch")?function(e,n,r){console.log("prefetch",e),c.add(e);const i=r?t.createElement("link"):s;n&&i.setAttribute("fetchPriority","high");i.href=e,i.rel="prefetch",i.as="document",r&&a.appendChild(i)}:!!u.supports("preload")&&H;if(!p&&!h)return;const v=navigator.connection||navigator.mozConnection||navigator.webkitConnection||{},m="string"==typeof v.effectiveType?v.effectiveType:"",w=-1!==m.indexOf("3g"),g=v.saveData||-1!==m.indexOf("2g");let b=t.body.dataset;const y="instantMousedownShortcut"in b,E="instantAllowQueryString"in b,A="instantAllowExternalLinks"in b,S=!("instantNoSpeculation"in b)&&HTMLScriptElement.supports&&HTMLScriptElement.supports("speculationrules"),L="instantWhitelist"in t.body.dataset,I=!g&&("instantViewport"in b||"instantViewportMobile"in b&&t.documentElement.clientWidth*t.documentElement.clientHeight<45e4),T=1111,C="instantIntensity"in b?+b.instantIntensity:65;p!==H&&t.addEventListener("touchstart",(function(t){O=!0,d=n.now();const e=x(t);if(!K(e))return;window.addEventListener("scroll",M,{once:!0}),l=setTimeout(D.bind(void 0,e,!0),C)}),{capture:!0,passive:!0});let k={capture:!0};if(t.addEventListener("mouseover",(function(t){if(n.now()-d<T)return;const e=x(t);if(!K(e))return;e.addEventListener("mouseout",M),l=setTimeout(D.bind(void 0,e,!1),C)}),k),y&&t.addEventListener("mousedown",(function(t){if(n.now()-d<T)return;if(t.which>1||t.metaKey||t.ctrlKey)return;const e=x(t);if(!e||"noInstant"in e.dataset||null!==e.getAttribute("download"))return;e.addEventListener("click",(t=>{1337!==t.detail&&t.preventDefault()}),{capture:!0,once:!0});const r=new MouseEvent("click",{bubbles:!0,cancelable:!0,detail:1337,view:window});e.dispatchEvent(r)}),k),h&&t.addEventListener("mousedown",(function(t){if(n.now()-d<T)return;if(t.which>1||t.metaKey||t.ctrlKey)return;const e=x(t);if(!K(e,!0))return;P(e.href,!0)}),k),I&&window.IntersectionObserver&&"isIntersecting"in IntersectionObserverEntry.prototype){const e=w?1:A?+b.instantLimit:1/0,n="instantScrollDelay"in b?+b.instantScrollDelay:1e3,r="instantThreshold"in b?+b.instantThreshold:.9,i="instantSelector"in b?b.instantSelector:"a",o=t=>{requestIdleCallback(t,{timeout:1500})},s=new Set;let a=0;o((()=>{const o=new IntersectionObserver((t=>{for(let r=0;r<t.length;++r){if(a>e)return;const i=t[r],c=i.target;i.isIntersecting?(s.add(c.href),++a,setTimeout((()=>{s.has(c.href)&&(o.unobserve(c),p(c.href,!1,!0))}),n)):(--a,s.delete(c.href))}}),{threshold:r}),c=t.querySelectorAll(i);for(let t=0;t<c.length;++t){const e=c[t];K(e)&&o.observe(e)}}))}b=u=k=null;let O=!1;function x(t,e){const n=e?t.relatedTarget:t.target;if(n&&"function"==typeof n.closest)return n.closest("a")}function D(t,e){h&&O?P(t.href,e):p(t.href,e,!(O&&(g||w))),l=void 0}function M(t){if(x(t)!==x(t,!0))return l?(clearTimeout(l),void(l=void 0)):(s.removeAttribute("rel"),s.removeAttribute("href"),s.removeAttribute("fetchPriority"),void s.removeAttribute("as"))}function K(t,n){let r;if(!t||!(r=t.href))return!1;if(!n&&c.has(r)||35===r.charCodeAt(0))return!1;const o=new URL(r);if(t.origin!=e.origin){if(!(A||"instant"in t.dataset)||!i)return!1}return("http:"===o.protocol||"https:"===o.protocol)&&(("http:"!==o.protocol||"https:"!==e.protocol)&&((!(L||!E&&o.search)||"instant"in t.dataset)&&((!o.hash||o.pathname+o.search!==e.pathname+e.search)&&(!("noInstant"in t.dataset)&&null===t.getAttribute("download")))))}function P(e,n){if(console.log("prerender",e),c.add(e),S){const n=t.createElement("script");return n.textContent=JSON.stringify({prerender:[{source:"list",urls:[e]}]}),n.type="speculationrules",void a.appendChild(n)}n&&s.setAttribute("fetchPriority","high"),s.href=e,s.rel="prerender"}function H(e,n,r){if(O)return;console.log("preload",e),c.add(e);const i=r?t.createElement("link"):s;n&&i.setAttribute("fetchPriority","high"),i.as="fetch",i.href=e,i.rel="preload",r&&a.appendChild(i)}}(document,location,Date);        
        </script>
        `,
    }),
  );

  // Add "private" tag to all internal methods added by `typedoc-plugin-missing-exports`
  app.renderer.hooks.on("content.begin", (context) => {
    if (context.page.url.includes("_internal_")) {
      return JSX.createElement(JSX.Raw, {
        html: `
        <div class="tsd-internal-warning-banner">
          <b>⚠️ Internal:</b> This API is not publically exported by the
          package.
        </div>
      `,
      });
    }
  });

  app.renderer.defineTheme("tsdocs", CustomTheme);
}

function updateSourceFilename(obj) {
  for (let key in obj) {
    if (typeof obj[key] === "object" && obj[key] !== null) {
      updateSourceFilename(obj[key]); // recursive call for nested objects/arrays
    } else {
      if (key === "sourceFileName" || key === "fileName") {
        obj[key] = obj[key].includes("node_modules/")
          ? obj[key].split("node_modules/")[1]
          : obj[key];
      }
    }
  }
}

async function convertAndWriteDocs(
  app: td.Application,
  {
    packageName,
    packageVersion,
  }: {
    packageName: string;
    packageVersion: string;
  },
) {
  if (app.logger.hasErrors()) {
    throw new Error("Invalid options passed.");
  }

  const convertTimer = logger.startTimer();
  const projectReflection = await app.convert();

  if (!projectReflection) {
    throw new Error("Compile error");
  }

  convertTimer.done({ message: `created typedoc for ${packageName}` });

  let serializedReflection = new Serializer().projectToObject(
    projectReflection,
    process.cwd(),
  );

  updateSourceFilename(serializedReflection);

  await DocsCache.set(packageName, packageVersion, serializedReflection);

  const generateTimer = logger.startTimer();
  await app.generateDocs(projectReflection, app.options.getValue("out"));
  generateTimer.done({ message: `generated html docs for ${packageName}` });

  if (app.logger.hasErrors()) {
    throw new Error("Output error");
  }
}

/**
 * typedoc generates CSS / JS assets per package.
 * This is a problem because a change in CSS overrides or global CSS
 * will result in previously cached docs to use the CSS at the time of
 * generation instead of the latest version. Here we delete common assets
 * in package dirs, and symlink it to a shared directory.
 *
 * The last built asset overwrites previous ones
 */
async function copyAndSymlinkAssets(assetsDir: string, assetFiles: string[]) {
  const sharedAssetsDir = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "docs-shared-assets",
    docsVersion,
  );
  if (!fs.existsSync(sharedAssetsDir)) {
    await fs.promises.mkdir(sharedAssetsDir, { recursive: true });
  }

  const promises = assetFiles
    .map((assetFile) => path.join(assetsDir, "assets", assetFile))
    .map(async (assetPath) => {
      if (!fs.existsSync(assetPath)) {
        return Promise.resolve();
      }
      const assetName = path.basename(assetPath);
      const sharedAssetPath = path.join(sharedAssetsDir, assetName);

      await fs.promises.copyFile(assetPath, sharedAssetPath);

      await fs.promises.unlink(assetPath);
      await fs.promises.symlink(sharedAssetPath, assetPath);
    });

  await Promise.all(promises);
}

export async function generateDocsForPackage(
  packageJSON,
  { force },
): Promise<{ docsPath: string }> {
  const docsPath = getDocsPath({
    packageName: packageJSON.name,
    packageVersion: packageJSON.version,
  });

  const typeDocFromCache = await DocsCache.get(
    packageJSON.name,
    packageJSON.version,
  );

  // Cache hit
  if (!force && typeDocFromCache) {
    logger.info(
      `Typedoc cache hit for ${packageJSON.name}@${packageJSON.version}`,
    );
    const cachedApp = await td.Application.bootstrapWithPlugins({
      ...generateDocsDefaultOptions(packageJSON.name),
      plugin: ["typedoc-plugin-mdn-links", "typedoc-plugin-rename-defaults"],
      out: docsPath,
    });

    setupApp(cachedApp);

    const projectFromCache = new td.Deserializer(cachedApp).reviveProject(
      typeDocFromCache,
      `${packageJSON.name} — ${packageJSON.version}`,
    );

    await generateDocsHTML(cachedApp, projectFromCache);

    return {
      docsPath,
    };
  }

  const installPath = await InstallationUtils.preparePath(
    packageJSON.name,
    packageJSON.version,
  );

  const packageString = `${packageJSON.name}@${packageJSON.version}`;
  // A package can refer to `@types` packages in its own types. By default
  // we don't install any dev dependencies, but we need to install these types
  // for resolving the type tree

  let devDependencyTypes = Object.entries(packageJSON.devDependencies || {})
    .filter(([depName]) => depName.startsWith("@types/"))
    .map(([depName, depVersion]) => `${depName}@${depVersion}`);

  // Include node inbuilt types for packages targeting node
  if (!devDependencyTypes.some((type) => type.startsWith("@types/node"))) {
    devDependencyTypes.push("@types/node@20.10.5");
  }

  logger.info("Package will be installed in", { installPath });

  const installJob = await installQueue.add(
    `install ${packageString}`,
    {
      packageName: packageJSON.name,
      packageVersion: packageJSON.version,
      additionalTypePackages: devDependencyTypes.join(" "),
      installPath,
    },
    {
      jobId: packageString + installPath,
      attempts: 1,
    },
  );

  await installJob.waitUntilFinished(installQueueEvents);

  let typeResolveResult: TypeResolveResult,
    typeResolutionType: "inbuilt" | "definitely-typed";

  typeResolveResult = await resolveTypePathInbuilt(
    installPath,
    packageJSON.name,
  );
  if (typeResolveResult) {
    typeResolutionType = "inbuilt";
  } else {
    typeResolveResult = await resolveTypePathDefinitelyTyped(packageJSON);
    typeResolutionType = "definitely-typed";
  }

  if (!typeResolveResult) {
    throw new TypeDefinitionResolveError({
      packageName: packageJSON.name,
      packageVersion: packageJSON.version,
    });
  }

  logger.info("Resolved type path", {
    installPath,
    resolveResult: typeResolveResult.typePath,
    typeResolutionType,
  });

  const tsConfigPath = await generateTSConfig(typeResolveResult.packagePath);

  let app: td.Application | undefined;

  try {
    let typesEntryContent = await fs.promises.readFile(
      typeResolveResult.typePath,
      "utf-8",
    );
    typesEntryContent = transformCommonJSExport(typesEntryContent);
    await fs.promises.writeFile(typeResolveResult.typePath, typesEntryContent);

    app = await td.Application.bootstrapWithPlugins({
      ...generateDocsDefaultOptions(packageJSON.name),
      plugin: ["typedoc-plugin-mdn-links", "typedoc-plugin-rename-defaults"],
      tsconfig: tsConfigPath,
      entryPoints: [typeResolveResult.typePath],
      out: docsPath,
      basePath: typeResolveResult.packagePath,
    });

    setupApp(app);

    await convertAndWriteDocs(app, {
      packageName: packageJSON.name,
      packageVersion: packageJSON.version,
    });
    await copyAndSymlinkAssets(docsPath, [
      "style.css",
      "custom.css",
      "highlight.css",
      "main.js",
    ]);
  } catch (error) {
    logger.error("TypeDoc exiting with unexpected error:", error);
    throw new TypeDocBuildError(error);
  }

  return {
    docsPath,
  };
}
