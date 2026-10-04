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
    echo " - Modo desarrollo en caliente: npm run electron:dev"
    echo " - Compilar y abrir (Local):    npm run electron:start"
    echo " - Generar AppImage (Local):    npm run dist:linux"
    echo " - Generar AppImage (Prod):     npm run dist:linux:prod"
    echo " - Ejecutar AppImage:           npm run appimage:run"
    echo "========================================="
  '';
}
