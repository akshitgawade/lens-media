# Deployment Guide

This project is ready to deploy as a React + Vite frontend with Supabase auth/data access.

## Required environment variables

Set these in your hosting platform:

- `VITE_SUPABASE_URL=https://lnycmvscjimmdritmoul.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=<your anon/publishable key>`
- `VITE_SUPABASE_PROJECT_ID=lnycmvscjimmdritmoul`

If you also run the app in a Node SSR or preview context, the same values can be provided as:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

## Vercel

1. Import the repository into Vercel.
2. Set the environment variables above in the project settings.
3. Use the default build command:
   - `npm run build`
4. Use the default output from Vite.
5. Deploy.

## Netlify

1. Import the repository into Netlify.
2. Set the environment variables above in Site settings.
3. Build command:
   - `npm run build`
4. Publish directory:
   - `dist`
5. Deploy.

## Supabase notes

- The frontend now points to your Supabase project ID `lnycmvscjimmdritmoul`.
- The Edge Function is called at:
  - `https://lnycmvscjimmdritmoul.supabase.co/functions/v1/analyze-article`
- `analyzeArticle()` sends both:
  - `apikey: <publishable key>`
  - `Authorization: Bearer <session access token or publishable key>`

## Quick checks before shipping

1. Confirm the demo data is present in your Supabase project.
2. Confirm the Edge Function is deployed.
3. Run a local production build:
   - `npm run build`
4. Test sign-in and a sample dashboard load.
