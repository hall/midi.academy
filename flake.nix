{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs";
    utils.url = "github:numtide/flake-utils";
  };
  outputs = inputs@{ self, ... }:
    inputs.utils.lib.eachDefaultSystem (system:
      let pkgs = inputs.nixpkgs.legacyPackages.${system}; in
      {
        devShells.default = with pkgs; mkShell {
          buildInputs = [
            nodejs
          ];
          shellHook = ''
            export PATH="$PATH:$PWD/node_modules/.bin"
          '';
        };
      });
}
