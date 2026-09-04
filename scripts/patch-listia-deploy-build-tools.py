from pathlib import Path

path = Path('.github/workflows/deploy-cloudflare-pages.yml')
text = path.read_text()

# Give the protected build + Workers upload enough room while still failing bounded.
if '    timeout-minutes: 20' not in text:
    count = text.count('    timeout-minutes: 15')
    if count != 1:
        raise SystemExit(f'deploy timeout anchor expected once, found {count}')
    text = text.replace('    timeout-minutes: 15', '    timeout-minutes: 20', 1)

# Validate the canonical Worker source before spending time building assets.
validate_anchor = "          set -Eeuo pipefail\n          grep -Fq \"ru:\" public/global-locales.js"
validate_new = "          set -Eeuo pipefail\n          node --check listia-app-worker/index.js\n          grep -Fq \"ru:\" public/global-locales.js"
if validate_new not in text:
    count = text.count(validate_anchor)
    if count != 1:
        raise SystemExit(f'worker validation anchor expected once, found {count}')
    text = text.replace(validate_anchor, validate_new, 1)

# Install all release tools once. Repeated npx resolution previously consumed most
# of the 15-minute deployment budget before Wrangler could finish uploading.
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
          npm install --prefix /tmp/listia-build-tools --no-save --ignore-scripts --no-audit --no-fund terser@5 csso-cli@4 wrangler@${WRANGLER_VERSION} >/dev/null
          TERSER=/tmp/listia-build-tools/node_modules/.bin/terser
          CSSO=/tmp/listia-build-tools/node_modules/.bin/csso
          WRANGLER=/tmp/listia-build-tools/node_modules/.bin/wrangler
          test -x \"$TERSER\"
          test -x \"$CSSO\"
          test -x \"$WRANGLER\"
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

old_deploy = 'if CLOUDFLARE_API_TOKEN="${token}" CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID}" npx --yes wrangler@${WRANGLER_VERSION} deploy --config wrangler-listia-app.jsonc 2>&1 | tee "/tmp/listia-app-${source}.log"; then'
new_deploy = 'WRANGLER=/tmp/listia-build-tools/node_modules/.bin/wrangler\n            test -x "${WRANGLER}"\n            if CLOUDFLARE_API_TOKEN="${token}" CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID}" "${WRANGLER}" deploy --config wrangler-listia-app.jsonc 2>&1 | tee "/tmp/listia-app-${source}.log"; then'
if new_deploy not in text:
    count = text.count(old_deploy)
    if count != 1:
        raise SystemExit(f'wrangler deploy anchor expected once, found {count}')
    text = text.replace(old_deploy, new_deploy, 1)

for needle in [
    'timeout-minutes: 20',
    'node --check listia-app-worker/index.js',
    'npm install --prefix /tmp/listia-build-tools',
    'wrangler@${WRANGLER_VERSION}',
    'TERSER=/tmp/listia-build-tools/node_modules/.bin/terser',
    'CSSO=/tmp/listia-build-tools/node_modules/.bin/csso',
    'WRANGLER=/tmp/listia-build-tools/node_modules/.bin/wrangler',
    '"${WRANGLER}" deploy --config wrangler-listia-app.jsonc',
]:
    if needle not in text:
        raise SystemExit(f'missing optimized deploy contract: {needle}')

path.write_text(text)
