// From https://github.com/Gerrit0/typedoc-plugin-missing-exports/blob/48c65892e05923cab8dd63c92d1ea153e8089c5a/index.ts

import { ok } from "assert";
import path from "path";
import {
  Application,
  Context,
  Converter,
  ReflectionKind,
  TypeScript as ts,
  ReferenceType,
  Reflection,
  DeclarationReflection,
  ProjectReflection,
} from "typedoc";
import fs from "fs";

declare module "typedoc" {
  export interface TypeDocOptionMap {
    internalModule: string;
  }
}

let hasMonkeyPatched = false;

// https://github.com/Gerrit0/typedoc-plugin-missing-exports/issues/12
function patchEscapedName(escapedName: string) {
  if (escapedName.includes("node_modules")) {
    const startIndex =
      escapedName.lastIndexOf("node_modules") + "node_modules".length + 1;
    const packagePath = escapedName.substring(startIndex);
    const fragments = packagePath.split(path.sep);

    if (packagePath.startsWith("@")) {
      return [fragments[0], fragments[1]].join(path.sep);
    } else {
      return fragments[0];
    }
  }
  return escapedName;
}

export function load(app: Application) {
  app["missingExportsPlugin"] = {
    activeReflection: undefined,
    referencedSymbols: new Map<ts.Program, Set<ts.Symbol>>(),
    symbolToActiveRefl: new Map<ts.Symbol, Reflection>(),
    knownPrograms: new Map<Reflection, ts.Program>(),
  };

  function discoverMissingExports(
    context: Context,
    program: ts.Program
  ): Set<ts.Symbol> {
    // An export is missing if if was referenced
    // Is not contained in the documented
    // And is "owned" by the active reflection
    const referenced =
      app["missingExportsPlugin"].referencedSymbols.get(program) || new Set();
    const ownedByOther = new Set<ts.Symbol>();
    app["missingExportsPlugin"].referencedSymbols.set(program, ownedByOther);

    for (const s of [...referenced]) {
      // Patch package name:
      if (s.escapedName) {
        // @ts-ignore
        s.escapedName = patchEscapedName(s.escapedName);
      }
      if (context.project.getReflectionFromSymbol(s)) {
        referenced.delete(s);
      } else if (
        app["missingExportsPlugin"].symbolToActiveRefl.get(s) !==
        app["missingExportsPlugin"].activeReflection
      ) {
        referenced.delete(s);
        ownedByOther.add(s);
      }
    }

    return referenced;
  }

  // Monkey patch the constructor for references so that we can get every
  const origCreateSymbolReference = ReferenceType.createSymbolReference;
  app["missingExportsPlugin"].createSymbolReference = function (
    symbol,
    context,
    name
  ) {
    ok(
      app["missingExportsPlugin"].activeReflection,
      "active reflection has not been set for " + symbol.escapedName
    );
    const set = app["missingExportsPlugin"].referencedSymbols.get(
      context.program
    );
    app["missingExportsPlugin"].symbolToActiveRefl.set(
      symbol,
      app["missingExportsPlugin"].activeReflection
    );
    if (set) {
      set.add(symbol);
    } else {
      app["missingExportsPlugin"].referencedSymbols.set(
        context.program,
        new Set([symbol])
      );
    }
    return origCreateSymbolReference.call(this, symbol, context, name);
  };

  ReferenceType.createSymbolReference = (symbol, context, name) => {
    return app["missingExportsPlugin"].createSymbolReference(
      symbol,
      context,
      name
    );
  };

  app.options.addDeclaration({
    name: "internalModule",
    help: "Define the name of the module that internal symbols which are not exported should be placed into.",
    defaultValue: "<internal>",
  });

  app.converter.on(
    Converter.EVENT_CREATE_DECLARATION,
    (context: Context, refl: Reflection) => {
      if (refl.kindOf(ReflectionKind.Project | ReflectionKind.Module)) {
        app["missingExportsPlugin"].knownPrograms.set(refl, context.program);
        app["missingExportsPlugin"].activeReflection = refl;
      }
    }
  );

  const basePath = path.join(app.options.getValue("basePath"), "..", "..");

  app.converter.on(
    Converter.EVENT_RESOLVE_BEGIN,
    function onResolveBegin(context: Context) {
      const modules: (DeclarationReflection | ProjectReflection)[] =
        context.project.getChildrenByKind(ReflectionKind.Module);
      if (modules.length === 0) {
        // Single entry point, just target the project.
        modules.push(context.project);
      }

      for (const mod of modules) {
        app["missingExportsPlugin"].activeReflection = mod;

        const program = app["missingExportsPlugin"].knownPrograms.get(mod);
        if (!program) continue;
        let missing = discoverMissingExports(context, program);
        if (!missing || !missing.size) continue;

        // Nasty hack here that will almost certainly break in future TypeDoc versions.
        context.setActiveProgram(program);

        const internalNs = context
          .withScope(mod)
          .createDeclarationReflection(
            ReflectionKind.Module,
            void 0,
            void 0,
            context.converter.application.options.getValue("internalModule")
          );
        context.finalizeDeclarationReflection(internalNs);
        const internalContext = context.withScope(internalNs);

        // Keep track of which symbols we've tried to convert. If they don't get converted
        // when calling convertSymbol, then the user has excluded them somehow, don't go into
        // an infinite loop when converting.
        const tried = new Set<ts.Symbol>();

        do {
          for (const s of missing) {
            if (shouldConvertSymbol(s, context.checker, basePath)) {
              internalContext.converter.convertSymbol(internalContext, s);
            }
            tried.add(s);
          }

          missing = discoverMissingExports(context, program);
          for (const s of tried) {
            missing.delete(s);
          }
        } while (missing.size > 0);

        // All the missing symbols were excluded, so get rid of our namespace.
        if (!internalNs.children?.length) {
          context.project.removeReflection(internalNs);
        }

        context.setActiveProgram(void 0);
      }

      app["missingExportsPlugin"].knownPrograms.clear();
      app["missingExportsPlugin"].referencedSymbols.clear();
      app["missingExportsPlugin"].symbolToActiveRefl.clear();
    },
    void 0,
    1e9
  );
}

// open a new file for appending
const fd = fs.openSync("./accessed", "a");

// append string to file
function shouldConvertSymbol(
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
  basePath: string
) {
  while (symbol.flags & ts.SymbolFlags.Alias) {
    symbol = checker.getAliasedSymbol(symbol);
  }

  // We're looking at an unknown symbol which is declared in some package without
  // type declarations. We know nothing about it, so don't convert it.
  if (symbol.flags & ts.SymbolFlags.Transient) {
    return false;
  }

  // This is something inside the special Node `Globals` interface. Don't convert it
  // because TypeDoc will reasonably assert that "Property" means that a symbol should be
  // inside something that can have properties.
  if (symbol.flags & ts.SymbolFlags.Property && symbol.name !== "default") {
    return false;
  }

  const isOutsideBase = (symbol.getDeclarations() ?? []).some(
    (node) => !node.getSourceFile().fileName.startsWith(basePath)
  );

  if (isOutsideBase) {
    return false;
  }

  return true;
}
