#!/usr/bin/env sh
# Ping IndexNow (Bing, Yandex, Naver, Seznam, Yep) after a deploy. Google does not use IndexNow;
# submit the sitemap in Search Console instead.
set -eu
KEY="dde588209f1d4d3db1c9ffb28a93f067"
curl -sS -X POST https://api.indexnow.org/indexnow -H 'Content-Type: application/json; charset=utf-8' -d @- <<JSON
{
  "host": "multiview.keepalive.studio",
  "key": "$KEY",
  "keyLocation": "https://multiview.keepalive.studio/$KEY.txt",
  "urlList": [
    "https://multiview.keepalive.studio/",
    "https://multiview.keepalive.studio/fr/",
    "https://multiview.keepalive.studio/zevent",
    "https://multiview.keepalive.studio/fr/zevent"
  ]
}
JSON
echo
