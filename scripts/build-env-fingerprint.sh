#!/bin/sh
# Prints a hash of every env var that changes vite build output: the envPrefix
# prefixes from vite.config.ts (keep in sync) plus POSTHOG_SOURCEMAPS.
# docker-entrypoint.sh compares this against the marker beside the last build
# to decide whether to rebuild; Dockerfile.railway writes the marker at image
# build time so a container whose env matches boots without rebuilding.
FINGERPRINT="$(env | grep -E '^(VITE_|AUTH_MODE|BYPASS_EMAIL_VERIFICATION|POSTHOG_PUBLIC_KEY|POSTHOG_HOST|TURNSTILE_SITE_KEY|POSTHOG_SOURCEMAPS)' | sort | sha256sum | cut -d' ' -f1)"
# A missing sha256sum would yield an empty, always-matching fingerprint and
# silently disable rebuilds — fail loudly instead.
test -n "$FINGERPRINT"
printf '%s' "$FINGERPRINT"
