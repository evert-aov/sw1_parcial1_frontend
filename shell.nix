{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs_22
    electron
    appimage-run
  ];

  shellHook = ''
    export ELECTRON_OVERRIDE_DIST_PATH="${pkgs.electron}/bin"
    echo "========================================="
    echo " Entorno NixOS listo para Diagramador UML"
    echo " - Modo desarrollo:  npm run electron:dev"
    echo " - Compilar y abrir: npm run electron:start"
    echo " - Correr AppImage:  appimage-run release/'Diagramador UML-1.0.0.AppImage'"
    echo "========================================="
  '';
}
