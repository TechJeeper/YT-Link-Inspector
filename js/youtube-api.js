// YouTube API utility functions
const YouTubeAPI = {
    accessToken: null, // Will be set from auth.js
    
    // Initialize the API (no longer needs apiKey)
    init() {
        // No init parameters needed for OAuth-only approach
    },
    
    // Set the access token for authenticated requests
    setAccessToken(token) {
        this.accessToken = token;
    },
    
    // Check if we have an access token
    hasAccessToken() {
        return !!this.accessToken;
    },
    
    // Build authorization header based on auth status
    getAuthHeaders() {
        if (this.accessToken) {
            return {
                'Authorization': `Bearer ${this.accessToken}`
            };
        }
        return {};
    },
    
    // Add auth to fetch options
    getFetchOptions(options = {}) {
        const defaultOptions = {
            headers: this.getAuthHeaders()
        };
        
        return { ...defaultOptions, ...options };
    },
    
    // Create API URL with access token
    createApiUrl(baseUrl, params = {}) {
        const url = new URL(baseUrl);
        
        // Add all params to URL
        Object.keys(params).forEach(key => {
            url.searchParams.append(key, params[key]);
        });
        
        return url.toString();
    },
    
    // Get channel ID from username or custom URL
    async getChannelId(username) {
        try {
            // If Google API is loaded, we can use it directly
            if (window.gapi?.client?.youtube) {
                try {
                    // First try by username
                    const response = await gapi.client.youtube.channels.list({
                        part: 'id',
                        forUsername: username
                    });
                    
                    if (response.result.items && response.result.items.length > 0) {
                        return response.result.items[0].id;
                    }
                    
                    // If not found, try search
                    return this.searchChannelByCustomUrl(username);
                } catch (error) {
                    console.error('Error using gapi for channel ID:', error);
                    // Fall back to regular fetch with access token
                }
            }
            
            // Only use this if gapi is not available but we have an access token
            if (this.accessToken) {
                const url = this.createApiUrl(
                    'https://www.googleapis.com/youtube/v3/channels',
                    {
                        part: 'id',
                        forUsername: username
                    }
                );
                
                const response = await fetch(url, this.getFetchOptions());
                
                if (!response.ok) {
                    throw new Error('Failed to fetch channel ID');
                }
                
                const data = await response.json();
                
                if (data.items && data.items.length > 0) {
                    return data.items[0].id;
                }
                
                // If not found by username, try search
                return this.searchChannelByCustomUrl(username);
            } else {
                throw new Error('Authentication required. Please sign in with Google.');
            }
        } catch (error) {
            console.error('Error fetching channel ID:', error);
            throw error;
        }
    },
    
    // Search for channel by custom URL (handle @username format)
    async searchChannelByCustomUrl(customUrl) {
        try {
            // Remove @ if present
            const searchTerm = customUrl.startsWith('@') ? customUrl.substring(1) : customUrl;
            
            // If Google API is loaded, we can use it directly
            if (window.gapi?.client?.youtube) {
                try {
                    const response = await gapi.client.youtube.search.list({
                        part: 'snippet',
                        q: searchTerm,
                        type: 'channel'
                    });
                    
                    if (response.result.items && response.result.items.length > 0) {
                        return response.result.items[0].channelId || response.result.items[0].id.channelId;
                    }
                    
                    throw new Error('Channel not found');
                } catch (error) {
                    console.error('Error using gapi for channel search:', error);
                    // Fall back to regular fetch with access token
                }
            }
            
            // Only use this if gapi is not available but we have an access token
            if (this.accessToken) {
                const url = this.createApiUrl(
                    'https://www.googleapis.com/youtube/v3/search',
                    {
                        part: 'snippet',
                        q: searchTerm,
                        type: 'channel'
                    }
                );
                
                const response = await fetch(url, this.getFetchOptions());
                
                if (!response.ok) {
                    throw new Error('Failed to search for channel');
                }
                
                const data = await response.json();
                
                if (data.items && data.items.length > 0) {
                    return data.items[0].channelId || data.items[0].id.channelId;
                }
                
                throw new Error('Channel not found');
            } else {
                throw new Error('Authentication required. Please sign in with Google.');
            }
        } catch (error) {
            console.error('Error searching for channel:', error);
            throw error;
        }
    },
    
    // Get videos from a channel
    async getChannelVideos(channelId, maxResults = 50) {
        try {
            // First, get the upload playlist ID
            
            // If Google API is loaded, we can use it directly
            if (window.gapi?.client?.youtube) {
                try {
                    // Get channel details
                    const channelResponse = await gapi.client.youtube.channels.list({
                        part: 'contentDetails',
                        id: channelId
                    });
                    
                    if (!channelResponse.result.items || channelResponse.result.items.length === 0) {
                        throw new Error('Channel not found');
                    }
                    
                    const uploadsPlaylistId = channelResponse.result.items[0].contentDetails.relatedPlaylists.uploads;
                    
                    // Now get the videos from the uploads playlist using the gapi client
                    const videos = [];
                    let nextPageToken = '';
                    
                    while (videos.length < maxResults) {
                        const pageSize = Math.min(50, maxResults - videos.length);
                        
                        const playlistResponse = await gapi.client.youtube.playlistItems.list({
                            part: 'snippet,contentDetails',
                            maxResults: pageSize,
                            playlistId: uploadsPlaylistId,
                            pageToken: nextPageToken || ''
                        });
                        
                        if (!playlistResponse.result.items || playlistResponse.result.items.length === 0) {
                            break;
                        }
                        
                        // Extract video information
                        const pageVideos = playlistResponse.result.items.map(item => ({
                            id: item.contentDetails.videoId,
                            title: item.snippet.title,
                            thumbnail: item.snippet.thumbnails.default.url,
                            url: `https://www.youtube.com/watch?v=${item.contentDetails.videoId}`,
                            description: item.snippet.description
                        }));
                        
                        videos.push(...pageVideos);
                        
                        // Check if there are more pages
                        if (!playlistResponse.result.nextPageToken) {
                            break;
                        }
                        
                        nextPageToken = playlistResponse.result.nextPageToken;
                    }
                    
                    return videos;
                } catch (error) {
                    console.error('Error using gapi for channel videos:', error);
                    // Fall back to regular fetch with access token
                }
            }
            
            // Only use this if gapi is not available but we have an access token
            if (this.accessToken) {
                // Fall back to regular fetch if gapi failed or isn't available
                const url = this.createApiUrl(
                    'https://www.googleapis.com/youtube/v3/channels',
                    {
                        part: 'contentDetails',
                        id: channelId
                    }
                );
                
                const response = await fetch(url, this.getFetchOptions());
                
                if (!response.ok) {
                    throw new Error('Failed to fetch channel details');
                }
                
                const data = await response.json();
                
                if (!data.items || data.items.length === 0) {
                    throw new Error('Channel not found');
                }
                
                const uploadsPlaylistId = data.items[0].contentDetails.relatedPlaylists.uploads;
                
                // Now get the videos from the uploads playlist
                return this.getPlaylistVideos(uploadsPlaylistId, maxResults);
            } else {
                throw new Error('Authentication required. Please sign in with Google.');
            }
        } catch (error) {
            console.error('Error fetching channel videos:', error);
            throw error;
        }
    },
    
    // Get videos from a playlist
    async getPlaylistVideos(playlistId, maxResults = 50) {
        try {
            const videos = [];
            let nextPageToken = '';
            
            // We'll limit to maxResults, but may need multiple API calls to get them
            while (videos.length < maxResults) {
                const pageSize = Math.min(50, maxResults - videos.length); // YouTube API max is 50 per request
                
                const params = {
                    part: 'snippet,contentDetails',
                    maxResults: pageSize,
                    playlistId: playlistId
                };
                
                if (nextPageToken) {
                    params.pageToken = nextPageToken;
                }
                
                const url = this.createApiUrl(
                    'https://www.googleapis.com/youtube/v3/playlistItems',
                    params
                );
                
                const response = await fetch(url, this.getFetchOptions());
                
                if (!response.ok) {
                    throw new Error('Failed to fetch playlist videos');
                }
                
                const data = await response.json();
                
                if (!data.items || data.items.length === 0) {
                    break;
                }
                
                // Extract video information
                const pageVideos = data.items.map(item => ({
                    id: item.contentDetails.videoId,
                    title: item.snippet.title,
                    thumbnail: item.snippet.thumbnails.default.url,
                    url: `https://www.youtube.com/watch?v=${item.contentDetails.videoId}`
                }));
                
                videos.push(...pageVideos);
                
                // Check if there are more pages
                if (!data.nextPageToken) {
                    break;
                }
                
                nextPageToken = data.nextPageToken;
            }
            
            // Get video descriptions (requires additional API calls)
            return this.getVideoDescriptions(videos);
        } catch (error) {
            console.error('Error fetching playlist videos:', error);
            throw error;
        }
    },
    
    // Get video descriptions (requires a separate API call)
    async getVideoDescriptions(videos) {
        try {
            // Process videos in chunks of 50 (API limitation)
            const results = [];
            
            for (let i = 0; i < videos.length; i += 50) {
                const chunk = videos.slice(i, i + 50);
                const videoIds = chunk.map(video => video.id).join(',');
                
                const url = this.createApiUrl(
                    'https://www.googleapis.com/youtube/v3/videos',
                    {
                        part: 'snippet',
                        id: videoIds
                    }
                );
                
                const response = await fetch(url, this.getFetchOptions());
                
                if (!response.ok) {
                    throw new Error('Failed to fetch video details');
                }
                
                const data = await response.json();
                
                if (!data.items) {
                    continue;
                }
                
                // Add descriptions to the video objects
                for (const item of data.items) {
                    const videoIndex = results.length + chunk.findIndex(v => v.id === item.id);
                    
                    if (videoIndex >= 0 && videoIndex < videos.length) {
                        results.push({
                            ...videos[videoIndex],
                            description: item.snippet.description
                        });
                    }
                }
            }
            
            return results;
        } catch (error) {
            console.error('Error fetching video descriptions:', error);
            throw error;
        }
    }
};

// Export the API object
if (typeof module !== 'undefined' && module.exports) {
    module.exports = YouTubeAPI;
} else {
    window.YouTubeAPI = YouTubeAPI;
} 