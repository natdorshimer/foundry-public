#!/bin/bash

nginx -g "daemon off;" &

for dir in /app/foundry/instances/*/; do
    node /app/foundry/server/resources/app/main.js --dataPath=$dir &
done

wait;