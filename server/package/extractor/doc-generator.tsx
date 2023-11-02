import * as td from "typedoc";
import {
  DefaultThemeRenderContext,
  ProjectReflection,
  TypeDocOptions,
} from "typedoc";
import path from "path";
import logger from "../../../common/logger";
import { generateTSConfig } from "./generate-tsconfig";
import { getDocsCachePath, getDocsPath } from "../utils";
import { TypeDefinitionResolveError } from "../CustomError";
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

  navigationLinks: {
    Home: "/",
  },
  navigation: {
    includeCategories: true,
    includeGroups: true,
  },
  useTsLinkResolution: true,
  categorizeByGroup: true,

  //    name: string;
  //    sourceLinkTemplate: string;
  //    gitRevision: string;
  //    gitRemote: string;
  //    gaID: string;
  theme: "default",
  lightHighlightTheme: "light-plus",
  darkHighlightTheme: "light-plus",

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
  //    logLevel: typeof LogLevel;
});

async function generateDocsHTML(
  app: td.Application,
  project: ProjectReflection,
) {
  app.renderer.hooks.on("head.end", () =>
    JSX.Raw({
      html: `
     <div>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;1,400&display=swap"
        rel="stylesheet"
      />
    `,
    }),
  );

  const generateTimer = logger.startTimer();
  await app.generateDocs(project, app.options.getValue("out"));
  generateTimer.done({ message: `generated html docs` });
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
    logger.error(app.logger.hasErrors());
    throw new Error("Invalid options passed.");
  }

  const convertTimer = logger.startTimer();
  const projectReflection = await app.convert();

  if (!projectReflection) {
    throw new Error("Compile error");
  }

  convertTimer.done({ message: `created typedoc for ${packageName}` });

  await DocsCache.set(
    packageName,
    packageVersion,
    new Serializer().projectToObject(projectReflection, process.cwd()),
  );

  // @ts-ignore
  //  app.renderer.hooks.on("body.begin", () => <SearchBox onSelect={() => {}} />);

  // Add "private" tag to all internal methods added by `typedoc-plugin-missing-exports`
  app.renderer.hooks.on("content.begin", (...args) => {
    if (args[0].page.url.includes("_internal_")) {
      return JSX.Raw({
        html: ` <div class="tsd-internal-warning-banner">
          <b>⚠️ Internal:</b> This API is not publically exported by the
          package.
        </div>`,
      });
    }
  });

  app.renderer.hooks.on("head.end", () =>
    JSX.Raw({
      html: ` <div>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,300;1,300&display=swap"
          rel="stylesheet"
        />
     </div>`,
    }),
  );

  const generateTimer = logger.startTimer();
  await app.generateDocs(projectReflection, app.options.getValue("out"));
  generateTimer.done({ message: `generated html docs for ${packageName}` });

  if (app.logger.hasErrors()) {
    throw new Error("Output error");
  }
}

const packumentCache = new Map();

export async function generateDocsForPackage(
  packageJSON,
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
  if (typeDocFromCache) {
    logger.info(
      `Typedoc cache hit for ${packageJSON.name}@${packageJSON.version}`,
    );
    const cachedApp = await td.Application.bootstrapWithPlugins({
      ...generateDocsDefaultOptions(packageJSON.name),
      plugin: ["typedoc-plugin-mdn-links", "typedoc-plugin-rename-defaults"],
      out: docsPath,
    });

    loadMissingExportsPlugin(cachedApp);

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

  await InstallationUtils.installPackage(
    [`${packageJSON.name}@${packageJSON.version}`],
    installPath,
    { client: "npm" },
  );

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
    resolveResult: typeResolveResult,
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

    loadMissingExportsPlugin(app);

    await convertAndWriteDocs(app, {
      packageName: packageJSON.name,
      packageVersion: packageJSON.version,
    });
  } catch (error) {
    logger.error("TypeDoc exiting with unexpected error:", error);
  }

  return {
    docsPath,
  };
}
