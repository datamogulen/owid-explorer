#!/usr/bin/env bash
# deploy.sh — lägger upp OWID-utforskaren på hedin.it/owid-explorer/.
#
#   bash deploy.sh          kod + katalog + serier + landgrid
#   bash deploy.sh --torr   visa vad som skulle hända, ladda inte upp
#
# hedin.it är ett cPanel-konto utan shell, så lftp:s SFTP-spegling används —
# samma väg som resten av hedin.it. Nyckeln (~/.ssh/hedin_deploy) lämnar aldrig
# maskinen. --delete körs ALDRIG mot public_html: där ligger trettio andra
# projekt. Speglingen är scopad till owid-explorer/ och dess underträd.

set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB="$HERE/web"
KEY="$HOME/.ssh/hedin_deploy"
HOST="hedin.it"
USER="bjornh"
FJARR="public_html/owid-explorer"

TORR=""
[[ "${1:-}" == "--torr" || "${1:-}" == "--dry-run" ]] && TORR="--dry-run"

command -v lftp >/dev/null || { echo "lftp saknas: brew install lftp"; exit 1; }
[[ -f "$KEY" ]] || { echo "saknar deploy-nyckel $KEY"; exit 1; }
[[ -d "$WEB/data/serier" ]] || { echo "kör export_explorer.py först"; exit 1; }

skript="set sftp:connect-program \"ssh -a -x -i $KEY -o StrictHostKeyChecking=accept-new\";
open sftp://$USER@$HOST;
mkdir -p $FJARR;
lcd $WEB;
cd $FJARR;
mirror -R $TORR --only-newer --parallel=4 --exclude-glob .DS_Store . .;
bye"

echo "→ $USER@$HOST:$FJARR ${TORR:+(TORRKÖRNING)}"
# cPanel nekar chmod över SFTP. Filerna går upp, men lftp returnerar ändå 1 —
# och med set -e dog skriptet tyst före kvittensen, som om deployen misslyckats.
# Sortera bort chmod-bruset och avgör på vad som faktiskt blev fel.
utdata="$(lftp -c "$skript" 2>&1 | grep -viE "^chmod|GetPass|^mkdir" || true)"
echo "$utdata" | tail -15
if echo "$utdata" | grep -qiE "fatal|permission denied|no such file|login failed"; then
  echo "✗ deployen gick inte igenom"; exit 1
fi
echo "✓ klart"
