// YouTube API utility functions
const YouTubeAPI = {
    apiKey: '', // Will be set from app.js
    
    // Initialize the API with your key
    init(apiKey) {
        this.apiKey = apiKey;
    },
    
    // Get channel ID from username or custom URL
    async getChannelId(username) {
        try {
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${username}&key=${this.apiKey}`
            );
            
            if (!response.ok) {
                throw new Error('Failed to fetch channel ID');
            }
            
            const data = await response.json();
            
            if (data.items && data.items.length > 0) {
                return data.items[0].id;
            }
            
            // If not found by username, try search
            return this.searchChannelByCustomUrl(username);
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
            
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchTerm}&type=channel&key=${this.apiKey}`
            );
            
            if (!response.ok) {
                throw new Error('Failed to search for channel');
            }
            
            const data = await response.json();
            
            if (data.items && data.items.length > 0) {
                return data.items[0].channelId || data.items[0].id.channelId;
            }
            
            throw new Error('Channel not found');
        } catch (error) {
            console.error('Error searching for channel:', error);
            throw error;
        }
    },
    
    // Get videos from a channel with optional date range
    async getChannelVideos(channelId, options = {}) {
        try {
            // First, get the upload playlist ID
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${this.apiKey}`
            );
            
            if (!response.ok) {
                throw new Error('Failed to fetch channel details');
            }
            
            const data = await response.json();
            
            if (!data.items || data.items.length === 0) {
                throw new Error('Channel not found');
            }
            
            const uploadsPlaylistId = data.items[0].contentDetails.relatedPlaylists.uploads;
            
            // Now get the videos from the uploads playlist
            return this.getPlaylistVideos(uploadsPlaylistId, options);
        } catch (error) {
            console.error('Error fetching channel videos:', error);
            throw error;
        }
    },
    
    // Get videos from a playlist with pagination and date filtering
    async getPlaylistVideos(playlistId, options = {}) {
        try {
            const {
                startDate,
                endDate,
                pageSize = 10,
                pageToken = ''
            } = options;

            const videos = [];
            let nextPageToken = pageToken;
            let totalResults = 0;
            
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${playlistId}&key=${this.apiKey}${nextPageToken ? '&pageToken=' + nextPageToken : ''}`
            );
            
            if (!response.ok) {
                throw new Error('Failed to fetch playlist videos');
            }
            
            const data = await response.json();
            nextPageToken = data.nextPageToken || '';
            
            if (!data.items || data.items.length === 0) {
                return {
                    videos: [],
                    nextPageToken: '',
                    totalResults: 0
                };
            }
            
            // Extract video information and filter by date if specified
            const pageVideos = data.items
                .map(item => {
                    const publishedAt = new Date(item.snippet.publishedAt);
                    return {
                        id: item.contentDetails.videoId,
                        title: item.snippet.title,
                        thumbnail: item.snippet.thumbnails.default.url,
                        url: `https://www.youtube.com/watch?v=${item.contentDetails.videoId}`,
                        channelId: item.snippet.channelId,
                        channelTitle: item.snippet.channelTitle,
                        publishedAt
                    };
                })
                .filter(video => {
                    if (!startDate && !endDate) return true;
                    
                    const videoDate = video.publishedAt;
                    if (startDate && videoDate < new Date(startDate)) return false;
                    if (endDate && videoDate > new Date(endDate)) return false;
                    return true;
                });
            
            // Get video descriptions
            const videosWithDesc = await this.getVideoDescriptions(pageVideos);
            
            return {
                videos: videosWithDesc,
                nextPageToken,
                totalResults: data.pageInfo.totalResults
            };
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
                
                const response = await fetch(
                    `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoIds}&key=${this.apiKey}`
                );
                
                if (!response.ok) {
                    throw new Error('Failed to fetch video details');
                }
                
                const data = await response.json();
                
                if (!data.items) {
                    continue;
                }
                
                // Add descriptions to the video objects
                for (const item of data.items) {
                    const videoIndex = chunk.findIndex(v => v.id === item.id);
                    
                    if (videoIndex >= 0) {
                        // Verify this video belongs to the expected channel
                        if (chunk[videoIndex].channelId === item.snippet.channelId) {
                            results.push({
                                ...chunk[videoIndex],
                                description: item.snippet.description
                            });
                        }
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