#!/bin/bash

# Deploy secrets to Fly.io for Nature Brawl
# Usage: ./scripts/deploy-secrets.sh

set -e

echo "🚀 Setting up Nature Brawl secrets for Fly.io..."

# Check if .gcp/service-account.json exists
if [ ! -f ".gcp/service-account.json" ]; then
    echo "❌ Error: .gcp/service-account.json not found"
    echo "Please ensure your service account file is at .gcp/service-account.json"
    exit 1
fi

# Check if .env exists for reference
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found. Please create one from env.example"
    echo "This script will set production values, but you may want to reference your .env file"
fi

# Read service account JSON and remove newlines
echo "📋 Reading service account JSON..."
SERVICE_ACCOUNT_JSON=$(cat .gcp/service-account.json | tr -d '\n' | tr -d ' ')

# Set secrets
echo "🔐 Setting Fly.io secrets..."

# Required secrets - you'll need to update these values
read -p "Enter your Replicate API token: " REPLICATE_TOKEN
read -p "Enter your production database URL: " DATABASE_URL
read -p "Enter your Fly.io app name (for SITE_URL): " FLY_APP_NAME

# Set all secrets
fly secrets set \
  REPLICATE_API_TOKEN="$REPLICATE_TOKEN" \
  DATABASE_URL="$DATABASE_URL" \
  GCS_BUCKET="naturebrawl-images" \
  GCS_PROJECT_ID="shining-camp-362017" \
  GCS_SERVICE_ACCOUNT_JSON="$SERVICE_ACCOUNT_JSON" \
  SITE_URL="https://${FLY_APP_NAME}.fly.dev"

echo "✅ Secrets deployed successfully!"
echo ""
echo "🔍 To verify your secrets were set correctly:"
echo "   fly secrets list"
echo ""
echo "🚀 To deploy your application:"
echo "   fly deploy" 