{
  description = "copy-urls — copy all highlighted tabs' URLs to the clipboard";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    nix-webext.url = "github:rivavolt/nix-webext";
  };

  outputs = { self, nixpkgs, nix-webext }:
    let
      forAllSystems = nixpkgs.lib.genAttrs [ "x86_64-linux" "aarch64-linux" ];
    in {
      packages = forAllSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          lib = pkgs.lib;

          version = (builtins.fromJSON (builtins.readFile ./package.json)).version;

          # Must match browser_specific_settings.gecko.id in wxt.config.ts.
          geckoId = "copy-urls@andreivolt";
          extId = "fhfllhicjoopejlkgbhpeogdlbbccbbp";

          firefoxAppDir = "share/mozilla/extensions/{ec8030f7-c20a-464f-9b0e-13a3a9e97384}";

          # FOD: bun resolves node_modules from the frozen lockfile. Network access is allowed only because the output is content-addressed by outputHash. The hash is per-system because esbuild/rollup install platform-native optional deps; bump both when bun.lock changes.
          nodeModules = pkgs.stdenvNoCC.mkDerivation {
            pname = "copy-urls-node-modules";
            inherit version;
            src = nixpkgs.lib.fileset.toSource {
              root = ./.;
              fileset = nixpkgs.lib.fileset.unions [
                ./package.json
                ./bun.lock
              ];
            };
            nativeBuildInputs = [ pkgs.bun ];
            dontConfigure = true;
            buildPhase = ''
              runHook preBuild
              export HOME=$TMPDIR
              bun install --frozen-lockfile --no-progress --ignore-scripts
              runHook postBuild
            '';
            installPhase = ''
              runHook preInstall
              mkdir -p $out
              cp -R node_modules $out/
              runHook postInstall
            '';
            dontFixup = true;
            outputHashMode = "recursive";
            outputHashAlgo = "sha256";
            outputHash = {
              x86_64-linux = "sha256-jf29Ql1GzMkyAPYUynDndRcrQO4VUc0teupSXQoi5DE=";
              aarch64-linux = "sha256-ZZHGDGwA4idZTteGK6qamwMNcxdIvOsxZ1mHPJ0ekQs=";
            }.${system};
          };

          # WXT compiles one bundle per browser target, both MV3: it emits
          # background.service_worker for Chrome and background.scripts plus the
          # gecko id for Firefox. These are independent bundles, not one manifest
          # projected — so nix-webext drives only the (keyless) Chrome CRX, and
          # the Firefox XPI is zipped from WXT's own firefox bundle below.
          wxtDist = browser:
            pkgs.stdenvNoCC.mkDerivation {
              pname = "copy-urls-${browser}";
              inherit version;
              src = self;
              nativeBuildInputs = [ pkgs.nodejs ];
              dontConfigure = true;
              buildPhase = ''
                runHook preBuild
                export HOME=$TMPDIR
                # The sandbox console is a PTY; wxt's consola spinner busy-loops on it, so force non-interactive output.
                export CI=true
                cp -R ${nodeModules}/node_modules node_modules
                chmod -R u+w node_modules
                node node_modules/.bin/wxt build -b ${browser} --mv3
                runHook postBuild
              '';
              installPhase = ''
                runHook preInstall
                mkdir -p $out
                cp -R .output/${browser}-mv3/. $out/
                runHook postInstall
              '';
              dontFixup = true;
            };

          extension = pkgs.runCommand "copy-urls-extension-${version}" { } ''
            mkdir -p $out/share/chromium-extension
            cp -R ${wxtDist "chrome"}/. $out/share/chromium-extension/
          '';

          # Chrome CRX (signed at activation from the sops key; build is keyless).
          # extId is the stable Chrome ID the old committed key derived.
          chromeExt = nix-webext.lib.mkBrowserExtension {
            inherit pkgs extension extId geckoId version;
            pname = "copy-urls";
            firefox = false;
            transformManifest = false;
          };

          # Firefox: zip WXT's firefox-mv3 bundle into an unsigned XPI.
          # sign-extension.sh in the nixos-config repo signs it via AMO.
          firefoxXpi = pkgs.stdenv.mkDerivation {
            pname = "copy-urls-firefox-xpi";
            inherit version;
            dontUnpack = true;
            nativeBuildInputs = [ pkgs.zip ];
            buildPhase = ''
              cd ${wxtDist "firefox"}
              zip -r $TMPDIR/extension.xpi .
            '';
            installPhase = ''
              mkdir -p $out/${firefoxAppDir}
              cp $TMPDIR/extension.xpi $out/${firefoxAppDir}/${geckoId}.xpi
            '';
          };
        in {
          chrome = chromeExt.chrome;
          firefox = firefoxXpi;

          default = pkgs.symlinkJoin {
            name = "copy-urls";
            paths = [
              chromeExt.chrome
              firefoxXpi
            ];
          };
        });
    };
}
