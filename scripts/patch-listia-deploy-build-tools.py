from pathlib import Path

path = Path('.github/workflows/deploy-cloudflare-pages.yml')
text = path.read_text()

validate_anchor = "          set -Eeuo pipefail\n          grep -Fq \"ru:\" public/global-locales.js"
validate_new = "          set -Eeuo pipefail\n          node --check listia-app-worker/index.js\n          grep -Fq \"ru:\" public/global-locales.js"
if validate_new not in text:
    count = text.count(validate_anchor)
    if count != 1:
        raise SystemExit(f'worker validation anchor expected once, found {count}')
    text = text.replace(validate_anchor, validate_new, 1)

old_tools = """          for file in dist-pwa/*.js; do
            [[ -f \"$file\" ]] || continue
            tmp=\"${file}.protected\"
            npx --yes terser@5 \"$file\" --compress passes=2,drop_console=false --mangle --comments false --output \"$tmp\"
            mv \"$tmp\" \"$file\"
          done
          for file in dist-pwa/*.css; do
            [[ -f \"$file\" ]] || continue
            tmp=\"${file}.protected\"
            npx --yes csso-cli@4 \"$file\" --output \"$tmp\"
            mv \"$tmp\" \"$file\"
          done
"""
new_tools = """          rm -rf /tmp/listia-build-tools
          npm install --prefix /tmp/listia-build-tools --no-save --ignore-scripts --no-audit --no-fund terser@5 csso-cli@4 >/dev/null
          TERSER=/tmp/listia-build-tools/node_modules/.bin/terser
          CSSO=/tmp/listia-build-tools/node_modules/.bin/csso
          test -x \"$TERSER\"
          test -x \"$CSSO\"
          for file in dist-pwa/*.js; do
            [[ -f \"$file\" ]] || continue
            tmp=\"${file}.protected\"
            \"$TERSER\" \"$file\" --compress passes=2,drop_console=false --mangle --comments false --output \"$tmp\"
            mv \"$tmp\" \"$file\"
          done
          for file in dist-pwa/*.css; do
            [[ -f \"$file\" ]] || continue
            tmp=\"${file}.protected\"
            \"$CSSO\" \"$file\" --output \"$tmp\"
            mv \"$tmp\" \"$file\"
          done
"""
if new_tools not in text:
    count = text.count(old_tools)
    if count != 1:
        raise SystemExit(f'build tools block expected once, found {count}')
    text = text.replace(old_tools, new_tools, 1)

for needle in [
    'node --check listia-app-worker/index.js',
    'npm install --prefix /tmp/listia-build-tools',
    'TERSER=/tmp/listia-build-tools/node_modules/.bin/terser',
    'CSSO=/tmp/listia-build-tools/node_modules/.bin/csso',
]:
    if needle not in text:
        raise SystemExit(f'missing optimized deploy contract: {needle}')

path.write_text(text)
