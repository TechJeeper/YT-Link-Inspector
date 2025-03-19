// Google API configuration
const GoogleAuth = {
    // Replace with your actual OAuth client ID from Google Cloud Console
    CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
    
    // API key to use after authentication (optional for OAuth)
    API_KEY: 'YOUR_API_KEY',
    
    // Authorization scopes required
    SCOPES: 'https://www.googleapis.com/auth/youtube.readonly',
    
    // Discovery documents
    DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest'],
    
    // Authentication state
    isAuthenticated: false,
    currentUser: null,
    
    // DOM elements
    elements: {
        authorizeButton: null,
        demoModeButton: null,
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
        this.elements.demoModeButton = document.getElementById('demo-mode-button');
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
        this.elements.demoModeButton.addEventListener('click', () => this.enableDemoMode());
        this.elements.signOutButton.addEventListener('click', () => this.handleSignOutClick());
        
        // Load the auth2 library and API client library
        this.loadAuthClient();
    },
    
    // Load the auth libraries
    loadAuthClient() {
        // Load the Google API client library
        gapi.load('client:auth2', () => this.initClient());
    },
    
    // Initialize the API client library
    async initClient() {
        try {
            await gapi.client.init({
                apiKey: this.API_KEY,
                clientId: this.CLIENT_ID,
                discoveryDocs: this.DISCOVERY_DOCS,
                scope: this.SCOPES
            });
            
            // Listen for sign-in state changes
            gapi.auth2.getAuthInstance().isSignedIn.listen((isSignedIn) => {
                this.updateSigninStatus(isSignedIn);
            });
            
            // Handle the initial sign-in state
            this.updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
        } catch (error) {
            console.error('Error initializing the API client library:', error);
            
            // Still allow demo mode to work even if authentication fails
            this.elements.authorizeButton.disabled = true;
            this.elements.authorizeButton.innerText = 'Auth Error - Try Demo';
        }
    },
    
    // Update the UI based on sign-in state
    updateSigninStatus(isSignedIn) {
        if (isSignedIn) {
            this.isAuthenticated = true;
            
            // Hide auth section, show input section
            this.elements.authSection.style.display = 'none';
            this.elements.inputSection.style.display = 'block';
            
            // Get user info
            this.handleSignedInUser();
        } else {
            this.isAuthenticated = false;
            
            // Show auth section, hide input section
            this.elements.authSection.style.display = 'block';
            this.elements.inputSection.style.display = 'none';
            this.elements.userInfo.style.display = 'none';
            this.elements.yourChannels.style.display = 'none';
            
            // Reset user info
            this.currentUser = null;
        }
    },
    
    // Handle the signed-in user
    async handleSignedInUser() {
        // Get the user's profile info
        const googleUser = gapi.auth2.getAuthInstance().currentUser.get();
        const profile = googleUser.getBasicProfile();
        
        this.currentUser = {
            id: profile.getId(),
            name: profile.getName(),
            email: profile.getEmail(),
            imageUrl: profile.getImageUrl()
        };
        
        // Update the UI
        this.elements.userName.textContent = this.currentUser.name;
        this.elements.userImage.src = this.currentUser.imageUrl;
        this.elements.userInfo.style.display = 'block';
        
        // Get the user's YouTube channels
        await this.getUserChannels();
        
        // Set the access token for YouTube API
        if (window.YouTubeAPI) {
            const authResponse = googleUser.getAuthResponse();
            YouTubeAPI.setAccessToken(authResponse.access_token);
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
        if (gapi.auth2) {
            gapi.auth2.getAuthInstance().signIn();
        } else {
            console.error('Auth client not initialized');
            // Provide fallback for demo mode
            this.enableDemoMode();
        }
    },
    
    // Handle sign out
    handleSignOutClick() {
        if (gapi.auth2) {
            gapi.auth2.getAuthInstance().signOut();
        }
    },
    
    // Enable demo mode (no authentication)
    enableDemoMode() {
        this.isAuthenticated = false;
        this.currentUser = null;
        
        // Hide auth section, show input section
        this.elements.authSection.style.display = 'none';
        this.elements.inputSection.style.display = 'block';
        this.elements.userInfo.style.display = 'none';
        this.elements.yourChannels.style.display = 'none';
    },
    
    // Get the authentication token
    getToken() {
        if (this.isAuthenticated && gapi.auth2) {
            const authInstance = gapi.auth2.getAuthInstance();
            if (authInstance.isSignedIn.get()) {
                return authInstance.currentUser.get().getAuthResponse().access_token;
            }
        }
        return null;
    }
};

// Initialize the auth module when the page loads
document.addEventListener('DOMContentLoaded', () => {
    GoogleAuth.init();
}); 