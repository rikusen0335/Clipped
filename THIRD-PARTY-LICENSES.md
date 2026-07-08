# Third-Party Licenses

Clipped itself is licensed under the MIT License (see [LICENSE](LICENSE)).
This application bundles or depends on the following third-party software.

## FFmpeg

This software uses code of [FFmpeg](https://ffmpeg.org) licensed under the
GPL v3 and its source can be downloaded from the links below.

- The bundled Windows binary is built by the
  [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds) project
  (win64 GPL build). Corresponding source code is available from that
  repository's releases and from <https://ffmpeg.org/download.html>.
- FFmpeg is a trademark of Fabrice Bellard, originator of the FFmpeg project.
- Full license text: [licenses/GPL-3.0.txt](licenses/GPL-3.0.txt)
  (also available at <https://www.gnu.org/licenses/gpl-3.0.txt>)

FFmpeg is invoked as a separate executable process; Clipped's own source code
is not a derivative work of FFmpeg and remains under the MIT License.

## Noto Sans JP

The bundled "Noto Sans JP" font is licensed under the
[SIL Open Font License 1.1](https://openfontlicense.org)
(© Google LLC / Adobe, via the Fontsource project).

## JavaScript / Rust dependencies

This application is built with open-source libraries including React,
Mantine, Tabler Icons, i18next (MIT License) and Tauri (MIT / Apache-2.0
dual license). See `package.json` and `src-tauri/Cargo.toml` for the full
dependency list; their license texts are included in their respective
packages.
