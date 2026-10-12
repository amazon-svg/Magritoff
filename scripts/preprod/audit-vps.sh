#!/usr/bin/env bash
# Diagnostic en lecture seule : aucun paquet installe, aucun service modifie.
set -u
printf '\nSysteme\n'
cat /etc/os-release
uname -r
printf '\nRessources\n'
free -h
nproc
df -h / /var
printf '\nPorts TCP en ecoute\n'
sudo ss -ltnp
printf '\nApache : virtual hosts et modules utiles\n'
sudo apache2ctl -S
sudo apache2ctl -M | awk '/proxy|ssl|headers|rewrite/ {print}'
printf '\nDocker\n'
if command -v docker >/dev/null; then
  docker --version
  docker compose version
else
  printf 'Docker absent\n'
fi
printf '\nPare-feu\n'
if command -v ufw >/dev/null; then sudo ufw status verbose; fi
