# Dotbuild

Dotbuild is a simple task-based developer toolchain for frontend devs who 
care about configuration by code, simplicitity and conventions where convenient. It is 
slightly inspired by the old Gulp taskrunner, but just runs Promise-based tasks without 
the streams paradigm. It utilizes developer tools like [esbuild](https://esbuild.github.io/) 
and [sass](https://sass-lang.com/), trying to reuse existing tools where possible, and use 
the Platform™ where feasible.

## New project

```bash
pnpm i @bitstillery/dotbuild --global
mkdir project;cd project
pnpm init; pnpm pkg set type="module"; 
pnpm dotbuild boilerplate
pnpm dotbuild dev
```

## Development

```bash
git@github.com:bitstillery/dotbuild.git
cd dotbuild
pnpm i
pnpm link --global
mkdir project;cd project
pnpm init; pnpm pkg set type="module"; 
pnpm link @bitstillery/dotbuild --global
pnpm dotbuild boilerplate
pnpm dotbuild dev
```