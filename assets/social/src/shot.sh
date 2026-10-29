#!/bin/zsh
# shot.sh in.html out.png W H
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --user-data-dir=/tmp/rmxchrome --screenshot="$2" --window-size=$3,$4 "file://$1" >/dev/null 2>&1
