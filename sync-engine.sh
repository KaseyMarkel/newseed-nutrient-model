#!/bin/sh
# engine/ is the source; site/engine/ is the copy the site loads. Run after editing engine/.
cd "$(dirname "$0")" && rm -rf site/engine && cp -R engine site/engine && echo "site/engine synced"
