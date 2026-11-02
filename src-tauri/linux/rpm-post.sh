# Runs as root inside dnf or rpm: it only prints, never opens the app, and never fails the install.
# rpm passes no version here, and querying its database from a scriptlet can wait on the transaction's lock.

case "${LANG:-}" in
  ru*) lang=ru ;;
  es*) lang=es ;;
  *) lang=en ;;
esac

if [ "${1:-1}" = 1 ]; then
  printf '\nWireCat is installed.\n\n'
  printf 'Next steps:\n'
  printf '  1. Open WireCat from your app menu, or run: wirecat-desktop\n'
else
  printf '\nWireCat is updated.\n\n'
  printf 'Next steps:\n'
  printf '  1. If WireCat is open, close it and open it again.\n'
fi
printf '  2. On the Tools page, install the tools you need and sign in.\n'
printf '  3. On the Agents page, connect your AI agent, then try a guide.\n\n'
printf 'Docs:   https://wirecat.dev/%s/docs/desktop\n' "$lang"
printf 'Remove: sudo dnf remove wirecat\n\n'

exit 0
