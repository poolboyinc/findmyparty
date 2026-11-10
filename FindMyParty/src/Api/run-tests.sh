#!/bin/bash
# Runs the API tests (needs Docker for the throwaway Postgres). Prints one line per test.
cd "$(dirname "$0")"
dotnet test FindMyParty.Api.Tests "$@" 2>&1 | grep -E "^\s+(Passed|Failed) |error |Passed!|Failed!" | sed -E 's/ \[[^]]+\]$//; s/FindMyParty\.Api\.Tests\.//' | sort
