# Development Environment Setup Guide

## 1. Copy Environment Variables

```bash
cp env.example .env
```

## 2. Set Required Environment Variables

Edit your `.env` file with these values:

```bash
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/naturebrawl

# Image Generation via Replicate
REPLICATE_API_TOKEN=your_replicate_token_here

# Google Cloud Storage
GCS_BUCKET=naturebrawl-images
GCS_PROJECT_ID=shining-camp-362017
GCS_KEYFILE=.gcp/service-account.json

# Site Configuration
SITE_URL=http://localhost:4321
```

## 3. Verify Service Account File

Make sure your service account file is at `.gcp/service-account.json` and contains valid JSON.

## 4. Test the Setup

Run the following to ensure everything is working:

```bash
yarn dev
```

The app should start without errors related to Google Cloud Storage configuration.

## 5. For Ngrok (if testing webhooks locally)

Install ngrok and run:

```bash
ngrok http 4321
```

This will provide a public URL that Replicate can use for webhooks during development.

## Common Issues

- **"No Google Cloud credentials found"**: Make sure your `.env` file has `GCS_KEYFILE=.gcp/service-account.json`
- **Permission errors**: Ensure your service account has Storage Object Admin role
- **Invalid JSON**: Check that your service account file is valid JSON
