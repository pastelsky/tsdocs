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
import { injectScript } from "@module-federation/nextjs-mf/utils";

import {
  TypeResolveResult,
  resolveTypePathDefinitelyTyped,
  resolveTypePathInbuilt,
} from "../resolvers";
import fs from "fs";
import { transformCommonJSExport } from "./augment-extract";
import { DocsCache } from "../DocsCache";
import { installQueue, installQueueEvents } from "../../queues";
import { icons } from "./icon";

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
  /**
   * When enabled, TypeDoc will include the generation time in <script>
   * and <link> tags to JS/CSS assets to prevent assets from a previous build of
   * the documentation from being used. This should generally not be necessary with a properly configured web server.
   */
  cacheBust: true,
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
  logLevel: "Warn",
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

const packumentCache = new Map();

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

  logger.info("Package will be installed in", { installPath });

  const packageString = `${packageJSON.name}@${packageJSON.version}`;

  const installJob = await installQueue.add(
    `install ${packageString}`,
    {
      packageName: packageJSON.name,
      packageVersion: packageJSON.version,
      installPath,
    },
    {
      jobId: packageString + installPath,
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
    typeResolveResult = await resolveTypePathDefinitelyTyped(
      packageJSON,
      packumentCache,
    );
    typeResolutionType = "definitely-typed";
  }

  if (!typeResolveResult) {
    throw new TypeDefinitionResolveError({
      packageName: packageJSON.name,
      packageVersion: packageJSON.version,
    });
  }

  logger.info("Resolved type path", {
    packageName: packageJSON.name,
    packageVersion: packageJSON.version,
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
