{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs";
    utils.url = "github:numtide/flake-utils";
  };
  outputs = inputs@{ self, ... }:
    inputs.utils.lib.eachDefaultSystem (system:
      let pkgs = inputs.nixpkgs.legacyPackages.${system}; in
      {
        # formatter = pkgs.nodejs.pkgs.prettier; # TODO: write inplace
        packages.default = with pkgs; let
          package = (with builtins; fromJSON (readFile ./package.json));
        in
        buildNpmPackage {
          pname = package.name;
          version = package.version;
          src = ./.;
          npmDepsHash = "sha256-AUJlV57cYu0jeMSk3y+3zO7/LCC+f0z5BQSrRKFsnp8=";
          nativeBuildInputs = [
            python310
            nodejs.pkgs.node-gyp-build
            pkg-config
          ];
          buildInputs = [ ]
            ++ (with xorg; [
            libX11
            libXi
            libXext
            libGL
          ]);
          installPhase = ''
            cp -r www $out
          '';
        };
        devShells.default = with pkgs; mkShell {
          inputsFrom = builtins.attrValues self.packages.${system};
          shellHook = ''
            export PATH="$PATH:$PWD/node_modules/.bin"
          '';
        };
      });
}
