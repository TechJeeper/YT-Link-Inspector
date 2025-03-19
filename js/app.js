// DOM Elements
const channelForm = document.getElementById('channel-form');
const channelInput = document.getElementById('channel-input');
const loadingSection = document.getElementById('loading-section');
const resultsSection = document.getElementById('results-section');
const errorSection = document.getElementById('error-section');
const errorMessage = document.getElementById('error-message');
const statusMessage = document.getElementById('status-message');
const resultsContainer = document.getElementById('results-container');
const videosCount = document.getElementById('videos-count');
const linksCount = document.getElementById('links-count');
const brokenCount = document.getElementById('broken-count');

// Statistics
let totalVideos = 0;
let totalLinks = 0;
let totalIssues = 0;

// Event Listeners
document.addEventListener('DOMContentLoaded', initApp);
channelForm.addEventListener('submit', handleFormSubmit);

// Initialize application
function initApp() {
    // Initialize YouTube API
    if (window.YouTubeAPI) {
        YouTubeAPI.init();
    }
    
    // Add event delegation for video result expansion
    resultsContainer.addEventListener('click', (e) => {
        const videoHeader = e.target.closest('.video-header');
        if (videoHeader) {
            const videoContent = videoHeader.nextElementSibling;
            videoContent.classList.toggle('active');
            
            const expandIcon = videoHeader.querySelector('.expand-icon');
            if (expandIcon) {
                expandIcon.classList.toggle('fa-chevron-down');
                expandIcon.classList.toggle('fa-chevron-up');
            }
        }
    });
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const channelUrl = channelInput.value.trim();
    
    if (!channelUrl) {
        showError('Please enter a valid YouTube channel URL');
        return;
    }
    
    // Reset counters
    totalVideos = 0;
    totalLinks = 0;
    totalIssues = 0;
    
    // Update stats display
    updateStats();
    
    // Hide results and errors
    resultsSection.style.display = 'none';
    errorSection.style.display = 'none';
    
    // Show loading
    loadingSection.style.display = 'block';
    statusMessage.textContent = 'Extracting channel ID...';
    
    try {
        const channelId = await extractChannelId(channelUrl);
        
        if (!channelId) {
            throw new Error('Could not extract channel ID from the provided URL');
        }
        
        await processChannel(channelId);
        
    } catch (error) {
        showError(error.message);
    } finally {
        loadingSection.style.display = 'none';
    }
}

// Extract Channel ID from various URL formats
async function extractChannelId(url) {
    try {
        // Try to extract from URL patterns
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        const pathname = urlObj.pathname;
        
        let channelId = null;
        
        // Handle YouTube channel URL formats
        if (hostname.includes('youtube.com')) {
            if (pathname.startsWith('/channel/')) {
                // Direct channel ID: youtube.com/channel/UC...
                channelId = pathname.split('/')[2];
            } else if (pathname.startsWith('/c/') || pathname.startsWith('/@')) {
                // Custom URL: youtube.com/c/ChannelName or youtube.com/@Username
                const username = pathname.split('/')[2];
                
                // Check if authenticated
                if (window.GoogleAuth && !GoogleAuth.isAuthenticated) {
                    throw new Error('Authentication required. Please sign in with Google to access YouTube data.');
                } else if (window.YouTubeAPI) {
                    // Use YouTube API with OAuth
                    statusMessage.textContent = 'Looking up channel by username...';
                    channelId = await YouTubeAPI.getChannelId(username);
                }
            } else if (pathname.startsWith('/user/')) {
                // Legacy username: youtube.com/user/Username
                const username = pathname.split('/')[2];
                
                // Check if authenticated
                if (window.GoogleAuth && !GoogleAuth.isAuthenticated) {
                    throw new Error('Authentication required. Please sign in with Google to access YouTube data.');
                } else if (window.YouTubeAPI) {
                    // Use YouTube API with OAuth
                    statusMessage.textContent = 'Looking up channel by legacy username...';
                    channelId = await YouTubeAPI.getChannelId(username);
                }
            }
        }
        
        return channelId;
    } catch (error) {
        console.error('Error extracting channel ID:', error);
        throw error;
    }
}

// Process the channel
async function processChannel(channelId) {
    statusMessage.textContent = 'Fetching videos from channel...';
    
    try {
        // Fetch videos using YouTube API
        const videos = await fetchChannelVideos(channelId);
        
        if (!videos || videos.length === 0) {
            throw new Error('No videos found in this channel');
        }
        
        // Update the total videos count
        totalVideos = videos.length;
        updateStats();
        
        // Process each video to check for links
        statusMessage.textContent = `Found ${videos.length} videos. Checking for links...`;
        
        // Clear previous results
        resultsContainer.innerHTML = '';
        
        // Process videos and check links
        for (let i = 0; i < videos.length; i++) {
            const video = videos[i];
            statusMessage.textContent = `Checking video ${i + 1} of ${videos.length}: ${video.title}`;
            await processVideo(video);
        }
        
        // Show the results section
        loadingSection.style.display = 'none';
        resultsSection.style.display = 'block';
        
        // Final stats update
        updateStats();
    } catch (error) {
        console.error('Error processing channel:', error);
        throw error;
    }
}

// Fetch videos from a channel using the YouTube API
async function fetchChannelVideos(channelId) {
    try {
        // Use YouTube API to get channel videos
        if (window.YouTubeAPI) {
            return await YouTubeAPI.getChannelVideos(channelId);
        }
        
        throw new Error('Authentication required. Please sign in with Google to access YouTube data.');
    } catch (error) {
        console.error('Error fetching channel videos:', error);
        throw error;
    }
}

// Process a single video
async function processVideo(video) {
    // Use the LinkValidator to extract and check URLs
    const links = LinkValidator.extractUrls(video.description);
    
    if (links.length === 0) {
        // No links to process
        appendVideoResult(video, []);
        return;
    }
    
    totalLinks += links.length;
    updateStats();
    
    // Check each link
    const processedLinks = [];
    
    for (const link of links) {
        const processedLink = await LinkValidator.validateLink(link);
        processedLinks.push(processedLink);
        
        if (processedLink.status !== 'valid') {
            totalIssues++;
            updateStats();
        }
    }
    
    // Add to results
    appendVideoResult(video, processedLinks);
}

// Append a video result to the results container
function appendVideoResult(video, links) {
    const videoResultElement = document.createElement('div');
    videoResultElement.className = 'video-result';
    
    // Calculate link statistics
    const validLinks = links.filter(link => link.status === 'valid').length;
    const brokenLinks = links.filter(link => link.status === 'broken').length;
    const suspiciousLinks = links.filter(link => link.status === 'suspicious').length;
    const totalIssuesForVideo = brokenLinks + suspiciousLinks;
    
    // Create the video header
    videoResultElement.innerHTML = `
        <div class="video-header">
            <div class="video-title">
                <i class="fas fa-chevron-down expand-icon"></i>
                <img src="${video.thumbnail}" alt="${video.title}" width="120" height="68">
                ${video.title}
            </div>
            <div class="video-stats">
                <span class="link-status ${totalIssuesForVideo > 0 ? 'status-broken' : 'status-valid'}">
                    ${links.length} Links, ${totalIssuesForVideo} Issues
                </span>
            </div>
        </div>
        <div class="video-content">
            <div class="video-links">
                ${links.length > 0 ? renderLinks(links) : '<p>No links found in this video description.</p>'}
            </div>
        </div>
    `;
    
    resultsContainer.appendChild(videoResultElement);
}

// Render link items
function renderLinks(links) {
    return links.map(link => `
        <div class="link-item ${link.status}">
            <a href="${link.url}" class="link-url" target="_blank" rel="noopener noreferrer">
                ${link.url}
            </a>
            <span class="link-status status-${link.status}">
                ${link.statusText}
            </span>
        </div>
    `).join('');
}

// Update statistics display
function updateStats() {
    videosCount.textContent = totalVideos;
    linksCount.textContent = totalLinks;
    brokenCount.textContent = totalIssues;
}

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorSection.style.display = 'block';
    loadingSection.style.display = 'none';
} 