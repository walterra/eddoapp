# Gmail OAuth Setup Guide

This guide explains how to configure Google Cloud Console to enable Gmail email sync in Eddo.

## Prerequisites

- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top and select **New Project**
3. Enter a project name (e.g., "Eddo App")
4. Click **Create**

## Step 2: Enable Gmail API

1. In the left sidebar, go to **APIs & Services → Library**
2. Search for "Gmail API"
3. Click on **Gmail API**
4. Click **Enable**

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen** (or **Google Auth Platform → Branding** in newer UI)
2. Select **External** user type and click **Create**
3. Fill in the required fields:
   - **App name**: Eddo (or your preferred name)
   - **User support email**: Your email address
   - **Developer contact email**: Your email address
4. Click **Save and Continue**

### Add Scopes

1. Go to **Data Access** (or **Scopes** section)
2. Click **Add or remove scopes**
3. Add the following scopes:
   - `https://mail.google.com/` (Gmail - full access, required for IMAP)
   - `email` (View email address)
   - `profile` (View basic profile info)
4. Click **Update** and then **Save**

> **Note**: The `https://mail.google.com/` scope is a **restricted scope**. For personal/development use, this works in Testing mode. For production with external users, you'll need to go through Google's verification process.

### Add Test Users (Testing Mode)

While the app is in "Testing" mode:

1. Go to **Audience** section
2. Under **Test users**, click **Add users**
3. Add the Gmail addresses that will use the app
4. Click **Save**

> **Important**: Only test users can authenticate while the app is in Testing mode. The app supports up to 100 test users.

## Step 4: Create OAuth Credentials

1. Go to **APIs & Services → Credentials** (or **Google Auth Platform → Clients**)
2. Click **Create Credentials → OAuth client ID**
3. Select **Web application** as the application type
4. Enter a name (e.g., "Eddo Web Client")
5. Add **Authorized JavaScript origins**:
   - `http://localhost:3000` (for development)
   - `https://localhost:3000` (if using HTTPS locally)
   - Your production domain (if applicable)
6. Add **Authorized redirect URIs**:
   - `http://localhost:3000/api/email/oauth/callback`
   - Your production callback URL (if applicable)
7. Click **Create**
8. Copy the **Client ID** and **Client Secret**

## Step 5: Configure Eddo Environment

Add the OAuth credentials to your `.env` file:

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/email/oauth/callback
```

## Step 6: Connect Gmail in Eddo

### Via Telegram Bot

1. Send `/email` to the Eddo Telegram bot
2. Send `/email connect` to start OAuth flow
3. Click the authorization link
4. Sign in with your Google account
5. Grant the requested permissions
6. You'll be redirected back and see a success message

### Via Web UI

1. Go to your Eddo profile settings
2. Navigate to the Integrations tab
3. In the Email Sync section, click **Connect Gmail**
4. Complete the OAuth flow

## Gmail Label Setup

Eddo syncs emails from a Gmail label called **"eddo"** (lowercase).

### Create the Label

1. In Gmail, click the **+** next to "Labels" in the left sidebar
2. Enter `eddo` as the label name
3. Click **Create**

### Add Emails to the Label

**Keyboard shortcut (fastest)**:

1. Enable keyboard shortcuts: Gmail Settings → General → Keyboard shortcuts → ON
2. Select email(s) with `x`
3. Press `l` to open label menu
4. Type `eddo` and press Enter

**Other methods**:

- Drag and drop emails to the "eddo" label
- Right-click → Label as → eddo
- Use Gmail filters for automatic labeling

### Automatic Labeling with Filters

To automatically label certain emails:

1. Click the search bar dropdown (▼) in Gmail
2. Set your criteria (e.g., `from:important@example.com`)
3. Click **Create filter**
4. Check **Apply the label** and select `eddo`
5. Optionally check **Also apply filter to matching conversations**
6. Click **Create filter**

## How Email Sync Works

1. Eddo periodically checks your "eddo" label (configurable interval, default 60 minutes)
2. All emails in the label are fetched (read or unread)
3. New emails become todos with:
   - **Title**: Email subject
   - **Description**: Email body (truncated)
   - **Context**: `email`
   - **Link**: Direct link back to the email in Gmail
   - **Tags**: `source:email`, `gtd:next`
4. Already-synced emails are skipped (deduplication via message ID)
5. Email read/unread status is not modified

## Troubleshooting

### "Invalid credentials" Error

- Ensure the Gmail API is enabled
- Verify all three scopes are added in Data Access
- Check that your email is in the Test Users list
- Try re-authenticating: `/email connect`

### "Folder does not exist" Error

- Create a label called `eddo` (lowercase) in Gmail
- Labels are case-sensitive

### Emails Not Syncing

- Check sync interval in settings (default: 60 minutes)
- Verify emails have the "eddo" label applied
- Check logs for errors: `pnpm logs:tail`

### OAuth Callback Fails

- Verify redirect URI matches exactly in Google Console
- Check that `GOOGLE_REDIRECT_URI` in `.env` matches the console setting
- Ensure the web-api server is running on the correct port

## Security Notes

- OAuth tokens are stored securely in CouchDB
- Only the "eddo" label is accessed - Eddo cannot read other emails
- Refresh tokens are used to maintain access without re-authentication
- You can revoke access anytime at [Google Account Permissions](https://myaccount.google.com/permissions)
