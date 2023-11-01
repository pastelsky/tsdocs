import * as path from "path";
import { Extractor, ExtractorConfig } from "@microsoft/api-extractor";

import type {
  IConfigFile,
  IExtractorInvokeOptions,
  ExtractorResult,
} from "@microsoft/api-extractor";

export type { IConfigFile };

export default class ApiExtractor {
  private readonly config: ExtractorConfig;

  constructor(config: IConfigFile) {
    if (!config.projectFolder) {
      throw new Error("Failed to init API extractor");
    }
    const packageJsonFullPath = path.join(config.projectFolder, "package.json");

    this.config = ExtractorConfig.prepare({
      configObjectFullPath: undefined,
      packageJsonFullPath,
      configObject: config,
    });
  }

  public extract = (opts: IExtractorInvokeOptions) =>
    new Promise<ExtractorResult>((resolve, reject) => {
      const result = Extractor.invoke(this.config, {
        ...opts,
      });

      if (!result.succeeded) {
        reject(result);
      }

      resolve(result);
    });
}
