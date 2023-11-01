import { promises } from "fs";
import * as prettier from "prettier";
import { Project } from "ts-morph";

const { readFile, writeFile } = promises;

const transformPrettier = (fileContent: string) => {
  return prettier.format(fileContent, {
    semi: false,
    singleQuote: true,
    parser: "typescript",
  });
};

/**
 * API extractor doesn't work well with exports of the form `export = Foo`,
 * so we transform it to the near-equivalent export default Foo
 * @see https://github.com/microsoft/rushstack/issues/3998
 **/
export const transformCommonJSExport = (fileContent: string) => {
  const project = new Project({
    useInMemoryFileSystem: true,
  });

  const sourceFile = project.createSourceFile("file.ts", fileContent);

  const exportAssignments = sourceFile.getExportAssignments();

  if (exportAssignments.length == 1) {
    exportAssignments[0].setIsExportEquals(false);
  }

  return sourceFile.getFullText();
};

export default async function augmentExtract(filePath: string) {
  const fileContent = await readFile(filePath, "utf8");

  let augmentedContent = fileContent;
  const transforms = [transformPrettier];

  for (let transform of transforms) {
    augmentedContent = await transform(augmentedContent);
  }

  await writeFile(filePath, augmentedContent);
}
