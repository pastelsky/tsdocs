// See https://github.com/microsoft/rushstack/issues/2142
import { Project, Node, Statement } from "ts-morph";
import fs from "fs";
import logger from "../../../common/logger";
import * as ts from "typescript";
export async function removeDeclareModule(filePath: string) {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(filePath);
  const statements = sourceFile.getStatements();
  const firstStatement = statements[0];
  const eligible =
    statements.length === 1 && Node.isModuleDeclaration(firstStatement);

  if (eligible) {
    const bodyText = firstStatement.getBodyText();
    logger.warn("Fixed %s by removing outer declare module", filePath);
    await fs.promises.writeFile(filePath, bodyText);
  }
}

export async function convertExportAssignment(filePath: string) {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(filePath);
  const statements = sourceFile.getStatements();
  const exportEqualAssignments = statements.filter(
    (statement) =>
      Node.isExportAssignment(statement) && statement.isExportEquals()
  );
  const firstExportEqualAssignment = exportEqualAssignments[0];
  const eligible = exportEqualAssignments.length === 1;

  if (eligible) {
    if (Node.isExportAssignment(firstExportEqualAssignment)) {
      firstExportEqualAssignment.setIsExportEquals(false);
    }
    logger.warn(
      "Fixed %s by converting export equals to default export",
      filePath
    );
    await fs.promises.writeFile(filePath, sourceFile.getText());
  }
}
