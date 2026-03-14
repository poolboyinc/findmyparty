#!/usr/bin/env bash
if [ -n "$MAPBOX_DOWNLOADS_TOKEN" ]; then
  echo "machine api.mapbox.com" >> ~/.netrc
  echo "login mapbox" >> ~/.netrc
  echo "password $MAPBOX_DOWNLOADS_TOKEN" >> ~/.netrc
  chmod 600 ~/.netrc
  echo "Mapbox .netrc entry written."
else
  echo "WARNING: MAPBOX_DOWNLOADS_TOKEN is not set."
fi
