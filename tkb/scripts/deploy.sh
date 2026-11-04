#!/bin/sh
# Dùng: sh scripts/deploy.sh "<proxy-path từ connector deploy-site>"
NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt NO_PROXY="" no_proxy="" npm_config_noproxy="" \
  npx -y @netlify/mcp@latest --site-id a4f1db92-b431-4e5f-9f96-fa1a60369ef5 --proxy-path "$1" 2>&1 | grep -E "Deploy is ready|Error|error" 
