# Dotbuild

Dotbuild is a simple opinionated async task-based frontend toolchain to build 
new efficient frontend applications with. It uses the following tools:

* [Esbuild](https://esbuild.github.io/) - Efficient bundler for TS/TSX
* [Sass](https://sass-lang.com/) - For organized & structured stylesheets

## Development
This project is still in its infancy. Do you want to try Dotbuild yourself? Use 
this workflow. The *New project* workflow is not finished yet.

```bash
git clone git@github.com:bitstillery/dotbuild.git
cd dotbuild
pnpm i
pnpm link --global
mkdir project;cd project
pnpm init; pnpm pkg set type="module"; 
pnpm link @bitstillery/dotbuild --global
dotbuild boilerplate
dotbuild dev
# Open localhost:3000
```

## New project

### SolidJS
This is a project starter for SolidJS:

* [SolidJS](https://github.com/solidjs/solid) - JSX Frontend framework
* [Solid Router](https://docs.solidjs.com/guides/how-to-guides/routing-in-solid/solid-router) - Routing for SolidJS 
* [I18next](https://www.i18next.com/) - Internationalisation

```bash
pnpm i @bitstillery/dotbuild --global
dotbuild boilerplate --template solidjs project
dotbuild dev
```