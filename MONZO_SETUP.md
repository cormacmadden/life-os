# Monzo Integration Setup

This guide will help you connect your Monzo bank account to the LifeOS dashboard.

## Features

Once connected, the Monzo widget displays:
- Current account balance
- Daily spending chart (last 7 days)
- Weekly spending total
- Real-time transaction data

## Prerequisites

1. A Monzo bank account (UK only)
2. Monzo Developer API access

## Quick Start (Recommended for Testing)

If you want to test the integration quickly without setting up OAuth:

1. **Go to the [Monzo API Playground](https://developers.monzo.com/api/playground)**

2. **Get an Access Token**:
   - Sign in with your Monzo account
   - On any endpoint page (e.g., "List accounts"), click **"Get OAuth Token"**
   - **IMPORTANT**: Make sure these permissions are selected:
     - ✅ Read account information
     - ✅ Read balance
     - ✅ Read transactions
   - Click "Get token"
   - Copy the access token that appears

3. **Add the token to your `.env` file**:
   ```bash
   MONZO_ACCESS_TOKEN=your_access_token_here
   ```

4. **Restart the backend**:
   ```bash
   # The backend should auto-reload, but if not:
   Ctrl+C and restart: uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
   ```

5. **Refresh your dashboard** - the Monzo widget should now show your data!

**Note**: Playground tokens expire after several hours, so you'll need to get a new one periodically.

## Full OAuth Setup (For Long-term Use)

For automatic token refresh without expiration:

### 1. Create a Monzo OAuth Client

1. Go to [Monzo Developers](https://developers.monzo.com/)
2. Sign in with your Monzo account
3. Click "Clients" in the navigation
4. Click "New OAuth Client"
5. Fill in the details:
   - **Name**: LifeOS Dashboard (or any name you prefer)
   - **Logo URL**: (optional)
   - **Redirect URLs**: Add your callback URL:
     - For local development: `http://localhost:8000/api/monzo/callback`
     - For remote access: `https://your-backend-url/api/monzo/callback`
   - **Description**: Personal finance dashboard integration
   - **Confidentiality**: Confidential

6. Click "Submit"
7. You'll receive:
   - **Client ID**: A public identifier for your app
   - **Client Secret**: A secret key (keep this secure!)

### 2. Configure Environment Variables

Add your Monzo credentials to the backend `.env` file:

```bash
# Monzo API Configuration
MONZO_CLIENT_ID=your_client_id_here
MONZO_CLIENT_SECRET=your_client_secret_here
MONZO_REDIRECT_URI=http://localhost:8000/api/monzo/callback
```

**Important**: Update `MONZO_REDIRECT_URI` to match your actual backend URL, especially if using Cloudflare Tunnel or other remote access methods.

### 3. Restart the Backend

After adding the environment variables, restart your FastAPI backend:

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Connect Your Account

1. Open your LifeOS dashboard
2. Navigate to the Monzo widget (Finance section)
3. Click the "connect monzo" button
4. You'll be redirected to Monzo's authorization page
5. Review the permissions and approve the connection
6. You'll be redirected back to your dashboard
7. The widget will automatically refresh and display your data

## API Endpoints

The backend provides these Monzo endpoints:

- `GET /api/monzo/auth` - Initiate OAuth flow
- `GET /api/monzo/callback` - OAuth callback handler
- `GET /api/monzo/status` - Check connection status
- `GET /api/monzo/accounts` - List Monzo accounts
- `GET /api/monzo/balance` - Get current balance
- `GET /api/monzo/transactions` - Get recent transactions
- `GET /api/monzo/spending-chart` - Get daily spending data for chart
- `POST /api/monzo/disconnect` - Disconnect Monzo account

## Features in Detail

### Balance Display
Shows your current account balance in the widget header. Updates automatically when you refresh.

### Spending Chart
Visualizes your daily spending over the last 7 days with a line chart. Each point represents total spending for that day.

### Weekly Spending
Calculates and displays your total spending for the last 7 days.

### Auto-refresh
Click the refresh icon to manually update your balance and transactions.

## Token Management

- Access tokens expire after a certain period
- The backend automatically refreshes expired tokens using the refresh token
- Tokens are stored in memory (for production, consider using a database)

## Security Notes

1. **Never commit** your `MONZO_CLIENT_SECRET` to version control
2. Keep your `.env` file secure and add it to `.gitignore`
3. Use HTTPS in production for the redirect URI
4. The Monzo API is rate-limited - avoid excessive requests

## Troubleshooting

### "Monzo API not configured" error
- Check that `MONZO_CLIENT_ID` and `MONZO_CLIENT_SECRET` are in your `.env` file
- Restart the backend after adding environment variables

### "Failed to get access token" error
- Verify your Client ID and Secret are correct
- Check that the redirect URI matches exactly (including http/https)
- Ensure your OAuth client is active in the Monzo Developer portal

### "Not connected to Monzo" error
- Complete the OAuth flow by clicking "connect monzo" in the widget
- If already connected, the token may have expired - try reconnecting

### Widget shows "Connect Monzo" after authentication
- Wait a few seconds for the status to update
- Refresh the page manually
- Check browser console for any API errors

## API Limitations

- Monzo's OAuth flow requires a browser redirect
- In development mode, you'll need to complete the OAuth flow on the same device/browser
- Access tokens expire and need periodic renewal
- Rate limiting applies to API requests

## Privacy

- Transaction data is fetched on-demand and not stored permanently
- OAuth tokens are stored in server memory
- No transaction data is sent to third parties
- All communication with Monzo uses HTTPS

## Production Considerations

For a production deployment:

1. Use a database to store OAuth tokens persistently
2. Implement proper user authentication
3. Use environment-specific redirect URIs
4. Set up proper error logging
5. Implement webhook support for real-time updates
6. Consider caching to reduce API calls
