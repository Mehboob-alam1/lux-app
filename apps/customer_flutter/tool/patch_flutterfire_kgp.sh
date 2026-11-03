#!/usr/bin/env bash
# Flutter statically scans plugin build.gradle for `apply plugin: 'kotlin-android'`.
# FlutterFire still leaves that behind an AGP9/builtInKotlin guard, which triggers a
# false-positive warning even when the apply never runs.
#
# With android.builtInKotlin=true (AGP 9+), those applies are unused. This script
# strips them from the resolved pub-cache packages. Re-run after `flutter pub get`.
set -euo pipefail

PUB_CACHE="${PUB_CACHE:-$HOME/.pub-cache/hosted/pub.dev}"
PACKAGES=(
  cloud_functions-7.0.1
  firebase_app_check-0.5.1
  firebase_auth-7.0.1
  firebase_core-5.1.0
)

patched=0
for pkg in "${PACKAGES[@]}"; do
  file="$PUB_CACHE/$pkg/android/build.gradle"
  if [[ ! -f "$file" ]]; then
    echo "skip (missing): $pkg"
    continue
  fi
  if ! grep -q "apply plugin: 'kotlin-android'" "$file"; then
    echo "ok (already patched): $pkg"
    continue
  fi
  python3 - "$file" <<'PY'
import pathlib, re, sys
path = pathlib.Path(sys.argv[1])
text = path.read_text()
# Remove AGP9 guard + kotlin-android apply (Flutter warns on the apply string alone).
pattern = re.compile(
    r"\n// AGP 9\+ has built-in Kotlin support unless Flutter opts out via android\.builtInKotlin=false\.\n"
    r"def agpMajor = com\.android\.Version\.ANDROID_GRADLE_PLUGIN_VERSION\.tokenize\('\.'\)\[0\] as int\n"
    r"def builtInKotlin = providers\.gradleProperty\(\"android\.builtInKotlin\"\)\n"
    r"\s*\.map \{ it\.toBoolean\(\) \}\n"
    r"\s*\.orElse\(agpMajor >= 9\)\n"
    r"\s*\.get\(\)\n"
    r"if \(agpMajor < 9 \|\| !builtInKotlin\) \{\n"
    r"[ \t]*apply plugin: 'kotlin-android'\n"
    r"\}\n",
    re.M,
)
new, n = pattern.subn("\n", text, count=1)
if n != 1:
    sys.exit(f"failed to patch {path}")
path.write_text(new)
print(f"patched: {path}")
PY
  patched=$((patched + 1))
done

echo "Done. Patched $patched package(s)."
