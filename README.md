# tsdocs.dev

<p align="center">
<img src="public/android-chrome-512x512.png" width="256" height="256" />
</p>

[TSDocs.dev](https://tsdocs.dev) is a service that lets you browse type reference documentation
for Javascript packages.

It works even with packages that aren't written in Typescript (sourced from DefinitelyTyped)
or when packages re-export types from other packages.

Its depends heavily on a customized version of [typedoc](https://github.com/TypeStrong/typedoc)
for generating API docs documentation.

## Writing good documentation for your library

`tsdocs.dev` extracts documentation from the type definitions that ships with libraries. In case a type definition is 
unavailable, it searches [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) for the closest equivalent.

For an example, see documentation for d3 —
https://tsdocs.dev/docs/d3/7.8.5/classes/FormatSpecifier.html

Internally tsdocs.dev uses a customized version of typedoc to parse 
and render documentation, which works on docstrings and markdown
https://typedoc.org/guides/doccomments/


## Development

1. Ensure that you have [redis installed](https://redis.io/docs/install/install-redis/) and running locally
2. Run `yarn install`
3. Run `yarn dev`

## Sponsors

<a href="https://www.digitalocean.com?utm_medium=opensource&utm_source=tsdocs"><img width="100px" src="https://upload.wikimedia.org/wikipedia/commons/f/ff/DigitalOcean_logo.svg"/></a>
