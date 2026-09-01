#!/bin/sh
# Poll PR 320 until no check is pending, then report the final buckets.
sleep 45
while true; do
  pending=$(gh pr checks 320 --json bucket | jq -r 'map(select(.bucket=="pending")) | length')
  if [ "$pending" = "0" ]; then
    break
  fi
  sleep 60
done
gh pr checks 320 | awk -F'\t' '{print $1": "$2}'
echo "ALL CI CHECKS SETTLED"
