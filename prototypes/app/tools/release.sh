#!/bin/sh
# Выкладка: время сборки → дымовая проверка → коммит и push в main (Render выкладывает сам) → зеркало в artlaboda/clever.
#   sh tools/release.sh <файл с сообщением коммита> [папка клона artlaboda/clever]
# Зеркало (prototypes/app в клоне artlaboda/clever, по умолчанию ../clever) уходит в ту ветку, что там сейчас выбрана.
# Клона нет — зеркало пропускается, об этом будет строка в конце.
set -e
MSG="$1"
test -f "$MSG" || { echo "нужен файл с сообщением коммита: sh tools/release.sh <файл>"; exit 1; }
MSG=$(cd "$(dirname "$MSG")" && pwd)/$(basename "$MSG")
N=$(cd "$(dirname "$0")/.." && pwd)
CL="${2:-$N/../clever}"
cd "$N"
test "$(git rev-parse --abbrev-ref HEAD)" = main || { echo "clever-newdiz не на main"; exit 1; }

# время сборки (по Минску) — его видно в профиле, по нему проверяем, что сборка доехала до сайта
t=$(TZ=Europe/Minsk date '+%d.%m · %H:%M')
sed -i "s/var BUILD = '[^']*';/var BUILD = '$t';/" index.html
grep -o "var BUILD = '[^']*'" index.html

# дымовая проверка: без «ошибки: нет» не выкладываем
OUT=$(mktemp)
node tools/smoke.js index.html | tail -1 | tee "$OUT"
grep -q "ошибки: нет" "$OUT"

git add CLAUDE.md README.md index.html desktop.css desktop.js tests/README.md tests/run.js tools/ img/fxv/ img/u/
git commit -q -F "$MSG"
git pull -q --rebase origin main
git push -q origin main
git log --oneline -1

if [ -d "$CL/prototypes/app" ]; then
    C="$CL/prototypes/app"
    cp index.html desktop.css desktop.js README.md CLAUDE.md "$C/"
    cp tests/run.js tests/README.md "$C/tests/"
    for f in tools/*; do [ -f "$f" ] && cp "$f" "$C/tools/"; done
    cp img/fxv/*.webp "$C/img/fxv/"
    cd "$CL"
    PM=$(mktemp); sed '1s/^/Прототип: /' "$MSG" > "$PM"
    git add prototypes/app CLAUDE.md 2>/dev/null || git add prototypes/app
    git commit -q -F "$PM"
    git push -q -u origin "$(git rev-parse --abbrev-ref HEAD)"
    git log --oneline -1
    git status --short | head -3
else
    echo "зеркало пропущено: нет $CL/prototypes/app"
fi
cd "$N" && git status --short | head -3
