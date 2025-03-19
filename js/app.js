// DOM Elements
const channelForm = document.getElementById('channel-form');
const channelInput = document.getElementById('channel-input');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
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
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const currentPageSpan = document.getElementById('current-page');

// API Key Elements
const apiKeyInput = document.getElementById('api-key-input');
const saveApiKeyBtn = document.getElementById('save-api-key-btn');
const rememberApiKey = document.getElementById('remember-api-key');
const apiKeyStatus = document.getElementById('api-key-status');
const apiKeyHelpLink = document.getElementById('api-key-help-link');
const apiKeyInstructions = document.getElementById('api-key-instructions');

// Pagination state
let currentPage = 1;
let nextPageToken = '';
let totalResults = 0;
let currentChannelId = '';
let currentOptions = {};

// Statistics
let totalVideos = 0;
let totalLinks = 0;
let totalIssues = 0;
let totalUnchecked = 0;

// Cookie name for storing API key
const API_KEY_COOKIE = 'yt_link_inspector_api_key';

// Global state for results pagination
let allVideoResults = [];
let videosPerPage = 10;
let currentSortType = null;

// Event Listeners
document.addEventListener('DOMContentLoaded', initApp);
channelForm.addEventListener('submit', handleFormSubmit);
saveApiKeyBtn.addEventListener('click', saveApiKey);
apiKeyHelpLink.addEventListener('click', toggleApiKeyInstructions);
prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        displayCurrentPage();
    }
});
nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(allVideoResults.length / videosPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        displayCurrentPage();
    }
});

// Add event listeners for stat sorting
videosCount.parentElement.addEventListener('click', () => sortResults('all'));
linksCount.parentElement.addEventListener('click', () => sortResults('links'));
brokenCount.parentElement.addEventListener('click', () => sortResults('issues'));
uncheckedCount.parentElement.addEventListener('click', () => sortResults('unchecked'));

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
    
    // Set max date for date inputs to today
    const today = new Date().toISOString().split('T')[0];
    startDateInput.max = today;
    endDateInput.max = today;
    
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
    
    // Reset state
    currentPage = 1;
    allVideoResults = [];
    currentSortType = null;
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
        
        const options = {
            startDate: startDateInput.value || null,
            endDate: endDateInput.value || null
        };
        
        await fetchAndProcessAllVideos(channelId, options);
        
        // Display results
        displayResults();
        
        // Show results
        statusMessage.textContent = 'Analysis complete!';
        resultsSection.style.display = 'block';
        loadingSection.style.display = 'none';
        
        // Add active class to stats for sorting indication
        updateStatHighlights('all');
        
    } catch (error) {
        showError(error.message);
        loadingSection.style.display = 'none';
    }
}

// Fetch and process all videos
async function fetchAndProcessAllVideos(channelId, options) {
    let nextPageToken = '';
    let totalProcessed = 0;
    
    while (true) {
        statusMessage.textContent = `Fetching videos... (${totalProcessed} processed)`;
        
        const result = await YouTubeAPI.getChannelVideos(channelId, {
            ...options,
            pageToken: nextPageToken
        });
        
        // Process each video
        for (const video of result.videos) {
            const processedVideo = await processVideo(video);
            allVideoResults.push(processedVideo);
            totalProcessed++;
        }
        
        if (!result.nextPageToken) {
            break;
        }
        nextPageToken = result.nextPageToken;
    }
    
    // Update total counts
    totalVideos = allVideoResults.length;
    updateStats();
}

// Process a single video and return the result
async function processVideo(video) {
    const links = LinkValidator.extractUrls(video.description);
    const processedLinks = [];
    
    if (links.length > 0) {
        totalLinks += links.length;
        updateStats();
        
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
    }
    
    return { video, links: processedLinks };
}

// Sort results based on clicked stat
function sortResults(sortType) {
    currentSortType = sortType;
    displayResults();
    updateStatHighlights(sortType);
}

// Update stat highlights to show active sort
function updateStatHighlights(activeType) {
    const statElements = [
        videosCount.parentElement,
        linksCount.parentElement,
        brokenCount.parentElement,
        uncheckedCount.parentElement
    ];
    
    statElements.forEach(el => el.classList.remove('active-sort'));
    
    switch (activeType) {
        case 'all':
            videosCount.parentElement.classList.add('active-sort');
            break;
        case 'links':
            linksCount.parentElement.classList.add('active-sort');
            break;
        case 'issues':
            brokenCount.parentElement.classList.add('active-sort');
            break;
        case 'unchecked':
            uncheckedCount.parentElement.classList.add('active-sort');
            break;
    }
}

// Display results based on current sort
function displayResults() {
    // Clear previous results
    resultsContainer.innerHTML = '';
    
    // Make a copy of results for sorting
    let sortedResults = [...allVideoResults];
    
    // Sort based on current sort type
    if (currentSortType === 'links') {
        // Sort by number of links (descending)
        sortedResults.sort((a, b) => b.links.length - a.links.length);
    } else if (currentSortType === 'issues') {
        // Sort by number of issues (descending)
        sortedResults.sort((a, b) => {
            const issuesA = a.links.filter(link => 
                link.status === 'broken' || link.status === 'suspicious').length;
            const issuesB = b.links.filter(link => 
                link.status === 'broken' || link.status === 'suspicious').length;
            return issuesB - issuesA;
        });
        
        // Filter to only show videos with issues
        sortedResults = sortedResults.filter(result => {
            return result.links.some(link => 
                link.status === 'broken' || link.status === 'suspicious');
        });
    } else if (currentSortType === 'unchecked') {
        // Sort by number of unchecked links (descending)
        sortedResults.sort((a, b) => {
            const uncheckedA = a.links.filter(link => link.status === 'unchecked').length;
            const uncheckedB = b.links.filter(link => link.status === 'unchecked').length;
            return uncheckedB - uncheckedA;
        });
        
        // Filter to only show videos with unchecked links
        sortedResults = sortedResults.filter(result => {
            return result.links.some(link => link.status === 'unchecked');
        });
    }
    
    // Add each video result to the container
    for (const result of sortedResults) {
        appendVideoResult(result.video, result.links);
    }
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