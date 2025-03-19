// DOM Elements
const channelForm = document.getElementById('channel-form');
const channelInput = document.getElementById('channel-input');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const maxVideosSelect = document.getElementById('max-videos');
const loadingSection = document.getElementById('loading-section');
const resultsSection = document.getElementById('results-section');
const errorSection = document.getElementById('error-section');
const errorMessage = document.getElementById('error-message');
const statusMessage = document.getElementById('status-message');
const resultsContainer = document.getElementById('results-container');
const videosCount = document.getElementById('videos-count');
const linksCount = document.getElementById('links-count');
const brokenCount = document.getElementById('broken-count');
const uncheckedCount = document.getElementById('unchecked-count');

// API Key Elements
const apiKeyInput = document.getElementById('api-key-input');
const saveApiKeyBtn = document.getElementById('save-api-key-btn');
const rememberApiKey = document.getElementById('remember-api-key');
const apiKeyStatus = document.getElementById('api-key-status');
const apiKeyHelpLink = document.getElementById('api-key-help-link');
const apiKeyInstructions = document.getElementById('api-key-instructions');

// Statistics
let totalVideos = 0;
let totalLinks = 0;
let totalIssues = 0;
let totalUnchecked = 0;
let currentSortMode = 'none'; // Track current sort mode

// Cookie name for storing API key
const API_KEY_COOKIE = 'yt_link_inspector_api_key';

// Event Listeners
document.addEventListener('DOMContentLoaded', initApp);
channelForm.addEventListener('submit', handleFormSubmit);
saveApiKeyBtn.addEventListener('click', saveApiKey);
apiKeyHelpLink.addEventListener('click', toggleApiKeyInstructions);

// Initialize application
function initApp() {
    // Load API key from cookie if available
    loadSavedApiKey();
    
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
    
    // Add click events for summary stats sorting
    videosCount.parentElement.addEventListener('click', () => sortResults('all'));
    linksCount.parentElement.addEventListener('click', () => sortResults('links'));
    brokenCount.parentElement.addEventListener('click', () => sortResults('issues'));
    uncheckedCount.parentElement.addEventListener('click', () => sortResults('unchecked'));
    
    // Disable submit button if no API key is set
    updateSubmitButtonState();
}

// Load API key from cookie
function loadSavedApiKey() {
    const savedApiKey = getCookie(API_KEY_COOKIE);
    
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
        rememberApiKey.checked = true;
        updateApiKeyStatus(true);
        
        // Initialize YouTube API with the saved key
        if (window.YouTubeAPI) {
            YouTubeAPI.init(savedApiKey);
        }
    }
}

// Save API key
function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
        showError('Please enter a valid YouTube API Key');
        return;
    }
    
    // Initialize YouTube API with the new key
    if (window.YouTubeAPI) {
        YouTubeAPI.init(apiKey);
    }
    
    // Save to cookie if remember is checked
    if (rememberApiKey.checked) {
        setCookie(API_KEY_COOKIE, apiKey, 30); // Save for 30 days
    } else {
        deleteCookie(API_KEY_COOKIE);
    }
    
    updateApiKeyStatus(true);
    updateSubmitButtonState();
    
    // Hide any previous errors
    errorSection.style.display = 'none';
}

// Toggle API key instructions visibility
function toggleApiKeyInstructions(e) {
    e.preventDefault();
    
    if (apiKeyInstructions.style.display === 'none') {
        apiKeyInstructions.style.display = 'block';
    } else {
        apiKeyInstructions.style.display = 'none';
    }
}

// Update API key status indicator
function updateApiKeyStatus(isSet) {
    const statusLabel = apiKeyStatus.querySelector('.status-label');
    
    if (isSet) {
        statusLabel.textContent = 'API Key set';
        statusLabel.classList.remove('not-set');
        statusLabel.classList.add('set');
    } else {
        statusLabel.textContent = 'API Key not set';
        statusLabel.classList.remove('set');
        statusLabel.classList.add('not-set');
    }
}

// Update submit button state based on API key
function updateSubmitButtonState() {
    const submitBtn = document.getElementById('submit-btn');
    const apiKey = apiKeyInput.value.trim();
    
    submitBtn.disabled = !apiKey;
    
    if (!apiKey) {
        submitBtn.classList.add('disabled');
    } else {
        submitBtn.classList.remove('disabled');
    }
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        showError('Please enter a YouTube API Key before inspecting a channel');
        return;
    }
    
    const channelUrl = channelInput.value.trim();
    if (!channelUrl) {
        showError('Please enter a valid YouTube channel URL');
        return;
    }
    
    // Get date range if provided
    const startDate = startDateInput.value ? startDateInput.value : null;
    const endDate = endDateInput.value ? endDateInput.value : null;
    
    // Get maximum videos to check
    let maxVideos = parseInt(maxVideosSelect.value);
    if (maxVideosSelect.value === 'all') {
        maxVideos = 10000; // Use a very high number to effectively get all videos
    }
    
    // Reset counters
    totalVideos = 0;
    totalLinks = 0;
    totalIssues = 0;
    totalUnchecked = 0;
    
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
        
        console.log('Using Channel ID:', channelId); // Debug
        
        // Display date range in status if provided
        let dateRangeText = '';
        if (startDate && endDate) {
            dateRangeText = ` from ${startDate} to ${endDate}`;
        } else if (startDate) {
            dateRangeText = ` since ${startDate}`;
        } else if (endDate) {
            dateRangeText = ` until ${endDate}`;
        }
        
        statusMessage.textContent = `Fetching up to ${maxVideos} videos${dateRangeText}...`;
        
        await processChannel(channelId, maxVideos, startDate, endDate);
        
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
        let username = null;
        
        console.log('Extracting from URL:', url);
        console.log('Pathname:', pathname);
        
        // Handle YouTube channel URL formats
        if (hostname.includes('youtube.com')) {
            if (pathname.startsWith('/channel/')) {
                // Direct channel ID: youtube.com/channel/UC...
                channelId = pathname.split('/')[2];
                console.log('Extracted direct channel ID:', channelId); // Debug
            } else if (pathname.startsWith('/c/')) {
                // Custom URL: youtube.com/c/ChannelName
                username = pathname.split('/')[2];
                
                statusMessage.textContent = 'Looking up channel by custom URL...';
                console.log('Looking up channel ID for custom URL:', username); // Debug
                channelId = await YouTubeAPI.getChannelId(username);
                console.log('Found channel ID for custom URL:', channelId); // Debug
            } else if (pathname.startsWith('/@')) {
                // Handle format: youtube.com/@Username
                username = pathname.substring(2); // Remove leading /@ to get Username
                
                statusMessage.textContent = 'Looking up channel by handle...';
                console.log('Looking up channel ID for handle:', username); // Debug
                channelId = await YouTubeAPI.getChannelId('@' + username);
                console.log('Found channel ID for handle:', channelId); // Debug
            } else if (pathname.startsWith('/user/')) {
                // Legacy username: youtube.com/user/Username
                username = pathname.split('/')[2];
                
                statusMessage.textContent = 'Looking up channel by legacy username...';
                console.log('Looking up channel ID for legacy username:', username); // Debug
                channelId = await YouTubeAPI.getChannelId(username);
                console.log('Found channel ID for legacy username:', channelId); // Debug
            }
        }
        
        return channelId;
    } catch (error) {
        console.error('Error extracting channel ID:', error);
        throw new Error('Invalid YouTube channel URL');
    }
}

// Process the channel
async function processChannel(channelId, maxVideos = 500, startDate = null, endDate = null) {
    try {
        statusMessage.textContent = 'Fetching videos from channel...';
        
        const videos = await YouTubeAPI.getChannelVideos(channelId, maxVideos, startDate, endDate);
        
        if (videos.length === 0) {
            showError('No videos found for this channel in the specified date range');
            return;
        }
        
        // Debug: Log the channel IDs of returned videos
        console.log('Video count:', videos.length);
        console.log('Expected channel ID:', channelId);
        console.log('Sample video channel IDs:', videos.slice(0, 3).map(v => v.channelId));
        
        totalVideos = videos.length;
        updateStats();
        
        statusMessage.textContent = `Processing ${videos.length} videos...`;
        
        // Clear previous results
        resultsContainer.innerHTML = '';
        
        // Reset sort mode
        currentSortMode = 'none';
        
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
        
        // Initialize the sorting UI
        sortResults('none');
        
    } catch (error) {
        showError(`Error processing channel: ${error.message}`);
    }
}

// Process a single video
async function processVideo(video) {
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
        
        if (processedLink.status === 'broken' || processedLink.status === 'suspicious') {
            totalIssues++;
            updateStats();
        } else if (processedLink.status === 'unchecked') {
            totalUnchecked++;
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
    const uncheckedLinks = links.filter(link => link.status === 'unchecked').length;
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
                    ${links.length} Links, ${totalIssuesForVideo} Issues${uncheckedLinks > 0 ? `, ${uncheckedLinks} Unchecked` : ''}
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
                ${link.attempts > 1 ? ` (${link.attempts} attempts)` : ''}
            </span>
        </div>
    `).join('');
}

// Update statistics display
function updateStats() {
    videosCount.textContent = totalVideos;
    linksCount.textContent = totalLinks;
    brokenCount.textContent = totalIssues;
    uncheckedCount.textContent = totalUnchecked;
}

// Sort results based on clicked summary stat
function sortResults(sortMode) {
    // If results section is not visible, don't do anything
    if (resultsSection.style.display === 'none') return;
    
    // Toggle sort mode if same stat is clicked
    if (currentSortMode === sortMode) {
        currentSortMode = 'none';
    } else {
        currentSortMode = sortMode;
    }
    
    // Update the visual state of stat containers
    const statContainers = [
        videosCount.parentElement,
        linksCount.parentElement, 
        brokenCount.parentElement, 
        uncheckedCount.parentElement
    ];
    
    statContainers.forEach(container => {
        container.classList.remove('active-sort');
        container.style.cursor = 'pointer'; // Ensure all stats have pointer cursor
    });
    
    // Add active class to current sort stat if not in 'none' mode
    if (currentSortMode !== 'none') {
        let activeContainer;
        switch (currentSortMode) {
            case 'all':
                activeContainer = videosCount.parentElement;
                break;
            case 'links':
                activeContainer = linksCount.parentElement;
                break;
            case 'issues':
                activeContainer = brokenCount.parentElement;
                break;
            case 'unchecked':
                activeContainer = uncheckedCount.parentElement;
                break;
        }
        if (activeContainer) {
            activeContainer.classList.add('active-sort');
        }
    }
    
    // Get all video results
    const videoResults = Array.from(resultsContainer.querySelectorAll('.video-result'));
    
    // Store old order to minimize DOM changes if sort hasn't changed
    const oldOrder = videoResults.map(el => el);
    
    // Sort based on selected mode
    if (currentSortMode === 'none') {
        // Reset to original order (by video order)
        videoResults.sort((a, b) => {
            return oldOrder.indexOf(a) - oldOrder.indexOf(b);
        });
    } else {
        videoResults.sort((a, b) => {
            const statsA = extractStatsFromVideoResult(a);
            const statsB = extractStatsFromVideoResult(b);
            
            // Sort in descending order (higher values first)
            switch (currentSortMode) {
                case 'all':
                    return 0; // No sorting, keep original order
                case 'links':
                    return statsB.links - statsA.links;
                case 'issues':
                    return statsB.issues - statsA.issues;
                case 'unchecked':
                    return statsB.unchecked - statsA.unchecked;
                default:
                    return 0;
            }
        });
    }
    
    // Apply the new order
    videoResults.forEach(video => {
        resultsContainer.appendChild(video);
    });
}

// Helper function to extract stats from a video result element
function extractStatsFromVideoResult(videoResultElement) {
    const statsText = videoResultElement.querySelector('.video-stats .link-status').textContent;
    
    // Parse stats from the text
    const linksMatch = statsText.match(/(\d+) Links/);
    const issuesMatch = statsText.match(/(\d+) Issues/);
    const uncheckedMatch = statsText.match(/(\d+) Unchecked/);
    
    return {
        links: linksMatch ? parseInt(linksMatch[1]) : 0,
        issues: issuesMatch ? parseInt(issuesMatch[1]) : 0,
        unchecked: uncheckedMatch ? parseInt(uncheckedMatch[1]) : 0
    };
}

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorSection.style.display = 'block';
    loadingSection.style.display = 'none';
}

// Cookie utilities
function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function deleteCookie(name) {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Strict`;
} 