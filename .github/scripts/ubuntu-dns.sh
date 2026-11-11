#!/usr/bin/env bash
# When the runner's resolver cannot find the Ubuntu mirrors (Canonical's DNS outage of 2026-11-11,
# actions/runner-images#15296), ask public resolvers and write the answer to /etc/hosts. apt still checks every
# package's signature, so an address from here cannot slip in a package. Does nothing while DNS works.
set -u
for host in azure.archive.ubuntu.com archive.ubuntu.com security.ubuntu.com; do
  getent hosts "$host" >/dev/null && continue
  ip=""
  for resolver in 1.1.1.1 8.8.8.8 9.9.9.9; do
    ip=$(dig +short +time=3 +tries=2 "$host" A "@$resolver" 2>/dev/null | grep -E '^[0-9.]+$' | head -1)
    [ -n "$ip" ] && break
  done
  if [ -n "$ip" ]; then
    echo "$ip $host" | sudo tee -a /etc/hosts >/dev/null
    echo "::warning::$host did not resolve on the runner, using $ip from $resolver"
  else
    echo "::warning::$host did not resolve on the runner or on public resolvers"
  fi
done
