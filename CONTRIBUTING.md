# Contributing

Thanks for your interest in contributing!


## local dev

Setup a local development environment (optionally/recommended, using only [nix](https://nixos.org/download.html#download-nix)).

```
nix develop
npm i
npm start
```


## package

Build the webpages (into the `./result` directory) with

```
nix build
```


## release

Bump the version in [`package.json`](./package.json) and update [`CHANGELOG.md`](./CHANGELOG.md).

A [GitHub Action](./.github/workflows/main.yml) will build and (if on the default branch) deploy the website.
