# tsdocs.dev

<p align="center">
<img src="public/android-chrome-512x512.png" width="256" height="256" />
</p>

[TSDocs.dev](tsdocs.dev) is a service that lets you browse type reference documentation
for Javascript packages.

It works even with packages that aren't written in Typescript (sourced from DefinitelyTyped)
or when packages re-export types from other packages.

Its depends heavily on a customized version of [typedoc](https://github.com/TypeStrong/typedoc)
for generating API docs documentation.

## Development

1. Ensure that you have redis running locally
2. Run `yarn install`
3. Run `yarn dev`
