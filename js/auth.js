// Google API configuration
const GoogleAuth = {
    // Replace with your actual OAuth client ID from Google Cloud Console
    CLIENT_ID: '655723817808-jkh1r6cms9vll7ehe4r9esvum85288ug.apps.googleusercontent.com',
    
    // Authorization scopes required
    SCOPES: 'https://www.googleapis.com/auth/youtube.readonly',
    
    // Discovery documents
    DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest'],
    
    // Authentication state
    isAuthenticated: false,
    currentUser: null,
    tokenClient: null,
    
    // DOM elements
    elements: {
        authorizeButton: null,
        signOutButton: null,
        authSection: null,
        inputSection: null,
        userInfo: null,
        userName: null,
        userImage: null,
        userChannels: null,
        yourChannels: null
    },
    
    // Initialize the authentication module
    init() {
        // Get DOM elements
        this.elements.authorizeButton = document.getElementById('authorize-button');
        this.elements.signOutButton = document.getElementById('sign-out-btn');
        this.elements.authSection = document.getElementById('auth-section');
        this.elements.inputSection = document.getElementById('input-section');
        this.elements.userInfo = document.getElementById('user-info');
        this.elements.userName = document.getElementById('user-name');
        this.elements.userImage = document.getElementById('user-image');
        this.elements.userChannels = document.getElementById('user-channels');
        this.elements.yourChannels = document.getElementById('your-channels');
        
        // Add event listeners
        this.elements.authorizeButton.addEventListener('click', () => this.handleAuthClick());
        this.elements.signOutButton.addEventListener('click', () => this.handleSignOutClick());
        
        // Load the auth client library
        this.loadAuthClient();
    },
    
    // Load the auth libraries
    loadAuthClient() {
        // Load the Google API client library first
        gapi.load('client', () => this.initClient());
        
        // We won't call initializeGsi directly, it will be triggered when gsi loads
    },
    
    // Initialize Google Identity Services
    initializeGsi() {
        if (typeof google === 'undefined' || !google.accounts) {
            console.log('Google Identity Services not yet loaded, will try again in 500ms');
            setTimeout(() => this.initializeGsi(), 500);
            return;
        }
        
        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: this.CLIENT_ID,
            scope: this.SCOPES,
            callback: (tokenResponse) => {
                if (tokenResponse && tokenResponse.access_token) {
                    // Token received, update state
                    this.isAuthenticated = true;
                    this.handleTokenReceived(tokenResponse.access_token);
                }
            },
            error_callback: (error) => {
                console.error('Error getting token:', error);
                this.updateSigninStatus(false);
            }
        });
    },
    
    // Initialize the API client library
    async initClient() {
        try {
            await gapi.client.init({
                apiKey: '',  // API Key is optional for this use case
                discoveryDocs: this.DISCOVERY_DOCS
            });
            
            // Check if we have an existing token in session storage
            const token = sessionStorage.getItem('yt_auth_token');
            if (token) {
                this.handleTokenReceived(token);
            } else {
                this.updateSigninStatus(false);
            }
            
            // Initialize GSI after gapi client is initialized
            this.initializeGsi();
        } catch (error) {
            console.error('Error initializing the API client library:', error);
            
            // Still allow demo mode to work even if authentication fails
            this.elements.authorizeButton.disabled = true;
            this.elements.authorizeButton.innerText = 'Auth Error - Try Demo';
        }
    },
    
    // Handle received token
    async handleTokenReceived(token) {
        // Set the access token for API requests
        gapi.client.setToken({ access_token: token });
        
        // Store token in session storage
        sessionStorage.setItem('yt_auth_token', token);
        
        // Update UI
        this.updateSigninStatus(true);
        
        // Get user profile info
        await this.fetchUserInfo(token);
    },
    
    // Fetch user info using the token
    async fetchUserInfo(token) {
        try {
            // Get user info from Google
            const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch user info');
            }
            
            const userInfo = await response.json();
            
            this.currentUser = {
                id: userInfo.sub,
                name: userInfo.name,
                email: userInfo.email,
                imageUrl: userInfo.picture
            };
            
            // Update the UI
            this.elements.userName.textContent = this.currentUser.name;
            this.elements.userImage.src = this.currentUser.imageUrl;
            this.elements.userInfo.style.display = 'block';
            
            // Get the user's YouTube channels
            await this.getUserChannels();
            
            // Set the access token for YouTube API
            if (window.YouTubeAPI) {
                YouTubeAPI.setAccessToken(token);
            }
        } catch (error) {
            console.error('Error fetching user info:', error);
        }
    },
    
    // Update the UI based on sign-in state
    updateSigninStatus(isSignedIn) {
        if (isSignedIn) {
            this.isAuthenticated = true;
            
            // Hide auth section, show input section
            this.elements.authSection.style.display = 'none';
            this.elements.inputSection.style.display = 'block';
        } else {
            this.isAuthenticated = false;
            
            // Show auth section, hide input section
            this.elements.authSection.style.display = 'block';
            this.elements.inputSection.style.display = 'none';
            this.elements.userInfo.style.display = 'none';
            this.elements.yourChannels.style.display = 'none';
            
            // Reset user info
            this.currentUser = null;
            
            // Clear session storage
            sessionStorage.removeItem('yt_auth_token');
        }
    },
    
    // Get the user's YouTube channels
    async getUserChannels() {
        try {
            // Clear the channels list
            this.elements.userChannels.innerHTML = '';
            
            // Make a request to the YouTube API to get the user's channels
            const response = await gapi.client.youtube.channels.list({
                part: 'snippet',
                mine: true
            });
            
            const channels = response.result.items;
            
            if (channels && channels.length > 0) {
                this.elements.yourChannels.style.display = 'block';
                
                // Add each channel to the list
                channels.forEach(channel => {
                    const channelItem = document.createElement('div');
                    channelItem.className = 'channel-item';
                    channelItem.dataset.channelId = channel.id;
                    
                    // Get the channel thumbnail
                    const thumbnailUrl = channel.snippet.thumbnails.default.url;
                    
                    channelItem.innerHTML = `
                        <img src="${thumbnailUrl}" alt="${channel.snippet.title}" class="channel-thumbnail">
                        <span class="channel-name">${channel.snippet.title}</span>
                    `;
                    
                    // Add click handler to select the channel
                    channelItem.addEventListener('click', () => {
                        // Set the channel URL in the input
                        document.getElementById('channel-input').value = `https://www.youtube.com/channel/${channel.id}`;
                        
                        // Submit the form
                        document.getElementById('channel-form').dispatchEvent(new Event('submit'));
                    });
                    
                    this.elements.userChannels.appendChild(channelItem);
                });
            } else {
                this.elements.yourChannels.style.display = 'none';
            }
        } catch (error) {
            console.error('Error fetching user channels:', error);
            this.elements.yourChannels.style.display = 'none';
        }
    },
    
    // Handle authentication with Google
    handleAuthClick() {
        if (this.tokenClient) {
            // Request an access token
            this.tokenClient.requestAccessToken();
        } else {
            console.error('Token client not initialized');
        }
    },
    
    // Handle sign out
    handleSignOutClick() {
        // Clear token
        gapi.client.setToken(null);
        
        // Clear session storage
        sessionStorage.removeItem('yt_auth_token');
        
        // Update UI
        this.updateSigninStatus(false);
        
        // Revoke the token
        if (this.getToken()) {
            fetch(`https://oauth2.googleapis.com/revoke?token=${this.getToken()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
        }
    },
    
    // Get the authentication token
    getToken() {
        if (this.isAuthenticated) {
            return sessionStorage.getItem('yt_auth_token');
        }
        return null;
    }
};

// Initialize the auth module when the page loads
document.addEventListener('DOMContentLoaded', () => {
    GoogleAuth.init();
}); 