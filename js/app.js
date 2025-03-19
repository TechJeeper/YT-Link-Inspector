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

// YouTube API key (you should use your own API key here)
// For GitHub hosting, you'd normally handle this more securely
const API_KEY = 'YOUR_YOUTUBE_API_KEY';

// Statistics
let totalVideos = 0;
let totalLinks = 0;
let totalIssues = 0;

// Event Listeners
document.addEventListener('DOMContentLoaded', initApp);
channelForm.addEventListener('submit', handleFormSubmit);

// Initialize application
function initApp() {
    // Initialize YouTube API with your API key
    if (window.YouTubeAPI) {
        YouTubeAPI.init(API_KEY);
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
                
                // If we're using the real YouTube API
                if (window.YouTubeAPI) {
                    statusMessage.textContent = 'Looking up channel by username...';
                    channelId = await YouTubeAPI.getChannelId(username);
                } else {
                    // For demo without API key
                    statusMessage.textContent = 'Simulating channel lookup...';
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    channelId = 'UC_demo_channel_id_' + username;
                }
            } else if (pathname.startsWith('/user/')) {
                // Legacy username: youtube.com/user/Username
                const username = pathname.split('/')[2];
                
                if (window.YouTubeAPI) {
                    statusMessage.textContent = 'Looking up channel by legacy username...';
                    channelId = await YouTubeAPI.getChannelId(username);
                } else {
                    // For demo without API key
                    statusMessage.textContent = 'Simulating channel lookup...';
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    channelId = 'UC_demo_channel_id_' + username;
                }
            }
        }
        
        return channelId;
    } catch (error) {
        console.error('Error extracting channel ID:', error);
        throw new Error('Invalid YouTube channel URL');
    }
}

// Process the channel
async function processChannel(channelId) {
    statusMessage.textContent = 'Fetching videos from channel...';
    
    try {
        let videos;
        
        // If we're using the real YouTube API with OAuth
        if (window.YouTubeAPI && (YouTubeAPI.hasAccessToken() || API_KEY !== 'YOUR_YOUTUBE_API_KEY')) {
            videos = await YouTubeAPI.getChannelVideos(channelId);
        } else {
            // For demo without API key, use mock data
            videos = await fetchChannelVideos(channelId);
        }
        
        if (!videos || videos.length === 0) {
            showError('No public videos found for this channel');
            return;
        }
        
        totalVideos = videos.length;
        updateStats();
        
        statusMessage.textContent = `Processing ${videos.length} videos...`;
        
        // Clear previous results
        resultsContainer.innerHTML = '';
        
        // Process each video
        for (let i = 0; i < videos.length; i++) {
            const video = videos[i];
            const videoIndex = i + 1;
            
            statusMessage.textContent = `Processing video ${videoIndex}/${videos.length}...`;
            
            await processVideo(video);
        }
        
        // Show results
        statusMessage.textContent = 'Analysis complete!';
        resultsSection.style.display = 'block';
        
    } catch (error) {
        showError(`Error processing channel: ${error.message}`);
    }
}

// Fetch videos from a channel (simulated for this demo)
async function fetchChannelVideos(channelId) {
    // In a real application, you would use the YouTube API
    // For this demo, we'll create mock data
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Generate mock videos (5-10 random videos)
    const videoCount = Math.floor(Math.random() * 6) + 5;
    const videos = [];
    
    for (let i = 0; i < videoCount; i++) {
        videos.push({
            id: `video_${i}_${Date.now()}`,
            title: `Sample Video ${i + 1}`,
            description: generateMockDescription(),
            thumbnail: 'https://via.placeholder.com/120x68',
            url: `https://youtube.com/watch?v=mock_video_${i}`
        });
    }
    
    return videos;
}

// Generate a mock description with links
function generateMockDescription() {
    const linkCount = Math.floor(Math.random() * 6) + 1; // 1-6 links
    const links = [];
    
    // Common link types
    const linkTypes = [
        'https://example.com/valid-link',
        'https://broken-link-example.org/404',
        'https://suspicious-domain-example.biz/',
        'https://github.com/user/repo',
        'https://twitter.com/username',
        'https://instagram.com/username',
        'https://parked-domain-example.com/'
    ];
    
    let description = "This is a sample video description.\n\n";
    
    for (let i = 0; i < linkCount; i++) {
        const randomIndex = Math.floor(Math.random() * linkTypes.length);
        const link = linkTypes[randomIndex] + (i + 1);
        links.push(link);
        description += `Check out this link: ${link}\n`;
    }
    
    return description;
}

// Process a single video
async function processVideo(video) {
    let links;
    
    // Use the LinkValidator if available
    if (window.LinkValidator) {
        links = LinkValidator.extractUrls(video.description);
    } else {
        links = extractLinks(video.description);
    }
    
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
        let processedLink;
        
        // Use the LinkValidator if available
        if (window.LinkValidator) {
            processedLink = await LinkValidator.validateLink(link);
        } else {
            processedLink = await checkLink(link);
        }
        
        processedLinks.push(processedLink);
        
        if (processedLink.status !== 'valid') {
            totalIssues++;
            updateStats();
        }
    }
    
    // Add to results
    appendVideoResult(video, processedLinks);
}

// Extract links from video description (fallback if LinkValidator not available)
function extractLinks(description) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = description.match(urlRegex) || [];
    
    // Return unique links
    return [...new Set(matches)];
}

// Check if a link is valid, broken, or suspicious (fallback if LinkValidator not available)
async function checkLink(url) {
    // In a real app, you would make an actual HTTP request to check the link
    // For demo purposes, we'll simulate this
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700));
    
    let status = 'valid';
    let statusText = 'Valid Link';
    
    // Simulate different link statuses based on URL
    if (url.includes('broken-link') || url.includes('404')) {
        status = 'broken';
        statusText = 'Broken Link (404 Not Found)';
    } else if (url.includes('parked-domain')) {
        status = 'suspicious';
        statusText = 'Parked Domain';
    } else if (url.includes('suspicious')) {
        status = 'suspicious';
        statusText = 'Suspicious Domain';
    } else if (Math.random() < 0.1) {
        // Randomly mark some links as broken (10% chance)
        status = 'broken';
        statusText = 'Connection Failed';
    }
    
    return {
        url,
        status,
        statusText
    };
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