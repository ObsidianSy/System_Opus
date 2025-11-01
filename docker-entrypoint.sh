#!/bin/sh
# Script para substituir a URL do backend no nginx.conf em runtime

# Valor padrão se a variável não for definida
BACKEND_URL=${BACKEND_URL:-"http://opus_backend:3001"}

echo "Configurando backend URL: $BACKEND_URL"

# Substitui no nginx.conf
sed -i "s|BACKEND_URL_PLACEHOLDER|$BACKEND_URL|g" /etc/nginx/conf.d/default.conf

# Inicia o nginx
nginx -g "daemon off;"
