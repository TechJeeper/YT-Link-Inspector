# YT Link Inspector

A web-based tool that helps YouTube content creators check their channel videos for broken or suspicious links in video descriptions.

## Features

- Simple and modern user interface
- Automatically fetches videos from a YouTube channel
- Checks all links found in video descriptions
- Identifies broken links, parked domains, and suspicious URLs
- Provides a detailed report with statistics
- Works directly in the browser (no server-side code required)

## How to Use

1. Obtain a YouTube Data API key from the [Google Developer Console](https://console.developers.google.com/)
2. Enter your API key in the application (with option to save it in your browser)
3. Enter your YouTube channel URL (formats supported: `/channel/ID`, `/c/ChannelName`, `/@username`, `/user/Username`)
4. Click "Inspect" and wait for the results
5. Review the detailed results that show which videos have broken or suspicious links
6. Fix the problematic links in your video descriptions on YouTube

## Getting a YouTube API Key

1. Go to the [Google Cloud Console](https://console.developers.google.com/)
2. Create a new project or select an existing one
3. From the navigation menu, select "APIs & Services" > "Library"
4. Search for "YouTube Data API v3" and click on it
5. Click "Enable" to activate this API for your project
6. Go to "APIs & Services" > "Credentials"
7. Click "Create Credentials" > "API key"
8. Copy your new API key and use it in the YT Link Inspector
9. For security, restrict your API key to only the YouTube Data API

## Technical Details

This application is built using pure HTML, CSS, and JavaScript. It can be hosted on GitHub Pages.

### YouTube API

The application uses the YouTube Data API to fetch channel and video information. Your API key is required for all operations. For privacy:

- Your API key is never sent to our servers
- You can opt to store your API key in a browser cookie for convenience
- The cookie is set with SameSite=Strict for security

### Link Validation

Link validation is performed by sending requests to check if links are valid. Since this app runs on the client side, it uses:

1. Pattern matching for known problematic domains
2. Simulated link checking

In a production environment, you would typically use a proxy API to check links due to CORS restrictions.

## Local Development

To run the application locally:

1. Clone this repository
2. Open the `index.html` file in your web browser
3. Enter your YouTube API key when prompted

## Limitations

- When hosted on GitHub Pages, the app can't directly check links due to CORS restrictions
- The YouTube API has usage quotas that may limit the number of videos that can be checked
- Very large channels with many videos may require multiple API calls

## License

This project is open source and available under the MIT License.

## Credits

- Font Awesome for icons
- Google Fonts for typography 