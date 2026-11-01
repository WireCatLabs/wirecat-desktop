#!/bin/sh
# Runs as root inside apt or dpkg: it only prints, never opens the app, and never fails the install.

[ "$1" = configure ] || exit 0

version=$(dpkg-query -W -f='${Version}' wirecat 2>/dev/null)
case "${LANG:-}" in
  ru*) lang=ru ;;
  es*) lang=es ;;
  *) lang=en ;;
esac

if [ -z "$2" ]; then
  printf '\nWireCat %s is installed.\n\n' "$version"
  printf 'Next steps:\n'
  printf '  1. Open WireCat from your app menu, or run: wirecat-desktop\n'
else
  if [ "$2" = "$version" ]; then
    printf '\nWireCat %s is installed again.\n\n' "$version"
  else
    printf '\nWireCat is updated from %s to %s.\n\n' "$2" "$version"
  fi
  printf 'Next steps:\n'
  printf '  1. If WireCat is open, close it and open it again.\n'
fi
printf '  2. On the Tools page, install the tools you need and sign in.\n'
printf '  3. On the Agents page, connect your AI agent, then try a guide.\n\n'
printf 'Docs:   https://wirecat.dev/%s/docs/desktop\n' "$lang"
printf 'Remove: sudo apt remove wirecat\n\n'

exit 0
