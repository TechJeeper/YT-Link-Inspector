# YT Link Inspector

A web-based tool that helps YouTube content creators check their channel videos for broken or suspicious links in video descriptions.

## Features

- Simple and modern user interface
- Google OAuth authentication to access your YouTube data
- Automatically fetches videos from a YouTube channel
- Checks all links found in video descriptions
- Identifies broken links, parked domains, and suspicious URLs
- Provides a detailed report with statistics
- Works directly in the browser (no server-side code required)

## How to Use

1. Open the website in your browser
2. Choose to sign in with your Google account or use demo mode
3. If you sign in, you can select from your YouTube channels directly
4. Otherwise, enter a YouTube channel URL (formats supported: `/channel/ID`, `/c/ChannelName`, `/@username`, `/user/Username`)
5. Click "Inspect" and wait for the results
6. Review the detailed results that show which videos have broken or suspicious links
7. Fix the problematic links in your video descriptions on YouTube

## Authentication

The app uses Google OAuth 2.0 for authentication, which provides several benefits:

- No need to manually create and paste in an API key
- Secure access to your own YouTube data
- Ability to select from your own channels
- Higher API usage quotas than with public API keys

Your credentials are never stored on any server. The app runs 100% in your browser.

## Technical Details

This application is built using pure HTML, CSS, and JavaScript. It can be hosted on GitHub Pages.

### YouTube API Access Methods

The application can access the YouTube API in three ways:

1. **OAuth 2.0 Authentication** (recommended): Sign in with your Google account for full access to your channels
2. **API Key** (for developers): If you have an API key, you can still use that by setting it in the code
3. **Demo Mode**: Uses simulated data for demonstration purposes

### Setting Up OAuth Credentials

To configure the application with your own OAuth credentials:

1. Go to the [Google Developer Console](https://console.developers.google.com/)
2. Create a new project
3. Enable the YouTube Data API v3
4. Create OAuth 2.0 credentials
5. Set the authorized JavaScript origins to your domain (e.g., `https://yourdomain.github.io`)
6. Replace `YOUR_GOOGLE_CLIENT_ID` in the `js/auth.js` file with your OAuth Client ID

### Link Validation

Link validation is performed by sending requests to check if links are valid. Since this app runs on the client side, it uses:

1. Pattern matching for known problematic domains
2. Simulated link checking for demo purposes

In a production environment, you would typically use a proxy API to check links due to CORS restrictions.

## Local Development

To run the application locally:

1. Clone this repository
2. Open the `index.html` file in your web browser
3. For full functionality, set up OAuth credentials as described above

## Limitations

- When hosted on GitHub Pages, the app can't directly check links due to CORS restrictions
- The YouTube API has usage quotas that may limit the number of videos that can be checked
- Very large channels with many videos may require multiple API calls

## License

This project is open source and available under the MIT License.

## Credits

- Font Awesome for icons
- Google Fonts for typography 