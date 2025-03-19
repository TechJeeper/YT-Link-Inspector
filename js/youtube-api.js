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
            
            console.log('Searching for channel with term:', searchTerm);
            
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchTerm}&type=channel&key=${this.apiKey}`
            );
            
            if (!response.ok) {
                throw new Error('Failed to search for channel');
            }
            
            const data = await response.json();
            console.log('Channel search results:', data.items ? data.items.length : 0);
            
            if (data.items && data.items.length > 0) {
                console.log('First channel result:', {
                    title: data.items[0].snippet.title,
                    channelId: data.items[0].channelId || data.items[0].id.channelId,
                    description: data.items[0].snippet.description
                });
                return data.items[0].channelId || data.items[0].id.channelId;
            }
            
            throw new Error('Channel not found');
        } catch (error) {
            console.error('Error searching for channel:', error);
            throw error;
        }
    },
    
    // Get videos from a channel
    async getChannelVideos(channelId, maxResults = 500, startDate = null, endDate = null) {
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
            return this.getPlaylistVideos(uploadsPlaylistId, maxResults, channelId, startDate, endDate);
        } catch (error) {
            console.error('Error fetching channel videos:', error);
            throw error;
        }
    },
    
    // Get videos from a playlist
    async getPlaylistVideos(playlistId, maxResults = 500, channelId = null, startDate = null, endDate = null) {
        try {
            const videos = [];
            let nextPageToken = '';
            
            console.log('Getting playlist videos for playlist:', playlistId);
            console.log('Filtering for channel ID:', channelId);
            console.log('Date range filter:', startDate, 'to', endDate);
            
            // Convert date strings to Date objects if provided
            const startDateTime = startDate ? new Date(startDate).getTime() : null;
            const endDateTime = endDate ? new Date(endDate).getTime() : null;
            
            // Continue fetching pages until we have all videos or reach maxResults
            let totalFetched = 0;
            
            while (nextPageToken !== null && videos.length < maxResults) {
                const pageSize = Math.min(50, maxResults - videos.length); // YouTube API max is 50 per request
                
                const response = await fetch(
                    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=${pageSize}&playlistId=${playlistId}&key=${this.apiKey}${nextPageToken ? '&pageToken=' + nextPageToken : ''}`
                );
                
                if (!response.ok) {
                    throw new Error('Failed to fetch playlist videos');
                }
                
                const data = await response.json();
                
                if (!data.items || data.items.length === 0) {
                    break;
                }
                
                totalFetched += data.items.length;
                
                // Extract video information
                const pageVideos = data.items.map(item => ({
                    id: item.contentDetails.videoId,
                    title: item.snippet.title,
                    thumbnail: item.snippet.thumbnails.default.url,
                    url: `https://www.youtube.com/watch?v=${item.contentDetails.videoId}`,
                    channelId: item.snippet.channelId, // Add channelId to verify ownership
                    channelTitle: item.snippet.channelTitle, // Add channel title for reference
                    publishedAt: item.snippet.publishedAt // Add published date for filtering
                }));
                
                console.log('Fetched videos in page:', pageVideos.length);
                
                // Filter videos by channel ID if provided
                let filteredVideos = channelId 
                    ? pageVideos.filter(video => video.channelId === channelId)
                    : pageVideos;
                    
                // Filter by date range if provided
                if (startDateTime || endDateTime) {
                    filteredVideos = filteredVideos.filter(video => {
                        const videoDate = new Date(video.publishedAt).getTime();
                        
                        if (startDateTime && endDateTime) {
                            return videoDate >= startDateTime && videoDate <= endDateTime;
                        } else if (startDateTime) {
                            return videoDate >= startDateTime;
                        } else if (endDateTime) {
                            return videoDate <= endDateTime;
                        }
                        
                        return true;
                    });
                }
                
                videos.push(...filteredVideos);
                
                console.log('Videos after filtering:', videos.length);
                
                // Check if there are more pages
                nextPageToken = data.nextPageToken || null;
                
                // Safety check to prevent infinite loops or excessive API calls
                if (totalFetched >= 10000) {
                    console.warn('Reached safety limit of 10,000 fetched videos');
                    break;
                }
            }
            
            console.log('Total videos after all filtering:', videos.length);
            
            // Get video descriptions (requires additional API calls)
            return this.getVideoDescriptions(videos, channelId);
        } catch (error) {
            console.error('Error fetching playlist videos:', error);
            throw error;
        }
    },
    
    // Get video descriptions (requires a separate API call)
    async getVideoDescriptions(videos, channelId = null) {
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
                        if (!channelId || chunk[videoIndex].channelId === item.snippet.channelId) {
                            results.push({
                                ...chunk[videoIndex],
                                description: item.snippet.description
                            });
                        } else {
                            console.log('Skipping video with mismatched channel ID:', item.id);
                            console.log(' - Expected:', channelId);
                            console.log(' - Found:', item.snippet.channelId);
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