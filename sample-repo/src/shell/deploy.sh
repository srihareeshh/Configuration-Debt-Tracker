#!/usr/bin/env bash

# Deployment automation script
echo "Deploying application..."

# Shell environment variable accesses
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL is not set"
    exit 1
fi

echo "Connecting to database with timeout ${API_TIMEOUT}"
