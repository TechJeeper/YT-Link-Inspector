// Link Validator Service
const LinkValidator = {
    // Known sites that block HEAD/GET requests but are typically valid
    knownValidDomains: [
        'amazon.com', 'amazon.co.uk', 'amazon.ca', 'amzn.to',
        'walmart.com', 'ebay.com', 'ebay.co.uk',
        'bestbuy.com', 'target.com'
    ],

    // Function to validate multiple links simultaneously
    async validateLinks(links) {
        const promises = links.map(link => this.validateLink(link));
        return Promise.all(promises);
    },
    
    // Function to validate a single link with retries
    async validateLink(url, maxRetries = 3) {
        let lastError = null;
        
        try {
            // First check if this is a known valid domain
            const urlObj = new URL(url);
            const domain = urlObj.hostname.toLowerCase();
            const isKnownDomain = this.knownValidDomains.some(known => 
                domain === known || domain.endsWith('.' + known)
            );
            
            if (isKnownDomain) {
                return {
                    url,
                    status: 'unchecked',
                    statusText: 'Known Domain (Not Checked)',
                    statusCode: 0,
                    attempts: 1
                };
            }
        } catch (urlError) {
            // If URL parsing fails, continue with normal validation
            console.warn('Error parsing URL:', urlError);
        }
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Make a real HTTP HEAD request to check the link
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
                
                try {
                    // First try with no-cors mode to see if resource exists
                    const noCorsResponse = await fetch(url, {
                        method: 'GET',
                        mode: 'no-cors',
                        redirect: 'follow',
                        signal: controller.signal,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (compatible; LinkChecker/1.0)'
                        }
                    });
                    
                    clearTimeout(timeout);
                    
                    // If we get here with no-cors, the resource exists but we can't check its status
                    // Try a HEAD request to get more info, but don't fail if it doesn't work
                    try {
                        const headResponse = await fetch(url, {
                            method: 'HEAD',
                            redirect: 'follow',
                            signal: controller.signal,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (compatible; LinkChecker/1.0)'
                            }
                        });
                        
                        // If HEAD request succeeds, use its status
                        return {
                            url,
                            status: headResponse.ok ? 'valid' : 'broken',
                            statusText: headResponse.ok ? 'Valid Link' : `HTTP Error ${headResponse.status}`,
                            statusCode: headResponse.status,
                            attempts: attempt
                        };
                    } catch (headError) {
                        // If HEAD fails but no-cors GET worked, consider it valid
                        return {
                            url,
                            status: 'valid',
                            statusText: 'Link Accessible (Limited Check)',
                            statusCode: 200,
                            attempts: attempt
                        };
                    }
                    
                } catch (fetchError) {
                    clearTimeout(timeout);
                    
                    // If no-cors fails, the resource is likely not available
                    if (attempt === maxRetries) {
                        let statusText = 'Connection Failed';
                        let statusCode = 0;
                        
                        // Determine more specific error messages
                        if (fetchError.message.includes('ENOTFOUND') || fetchError.message.includes('not found')) {
                            statusText = 'Domain Not Found';
                        } else if (fetchError.message.includes('ECONNREFUSED')) {
                            statusText = 'Connection Refused';
                        } else if (fetchError.message.includes('certificate')) {
                            statusText = 'SSL Certificate Error';
                        } else if (fetchError.message.includes('Failed to fetch')) {
                            statusText = 'Resource Not Available';
                        }
                        
                        return {
                            url,
                            status: 'broken',
                            statusText: `${statusText} (${maxRetries} attempts failed)`,
                            statusCode: statusCode,
                            error: fetchError.message,
                            attempts: attempt
                        };
                    }
                    
                    throw fetchError; // Rethrow to trigger retry
                }
                
            } catch (error) {
                console.error(`Error validating link (attempt ${attempt}/${maxRetries}):`, url, error);
                lastError = error;
                
                // Check if this was a timeout
                if (error.name === 'AbortError') {
                    if (attempt === maxRetries) {
                        return {
                            url,
                            status: 'broken',
                            statusText: 'Connection Timeout',
                            statusCode: 408,
                            error: 'Request timed out',
                            attempts: attempt
                        };
                    }
                }
                
                // Wait before retrying (exponential backoff)
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                }
            }
        }
        
        // This should only be reached if all retries failed
        return {
            url,
            status: 'broken',
            statusText: 'Connection Failed (All Attempts)',
            statusCode: 0,
            error: lastError?.message,
            attempts: maxRetries
        };
    },
    
    // Check if a domain appears suspicious
    isSuspiciousDomain(url) {
        try {
            const domain = new URL(url).hostname;
            
            // Check against known suspicious TLDs
            const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.club'];
            if (suspiciousTLDs.some(tld => domain.endsWith(tld))) {
                return true;
            }
            
            // Check for excessive subdomains
            const subdomains = domain.split('.');
            if (subdomains.length > 4) {
                return true;
            }
            
            // Check for domain typosquatting (simplified check)
            const popularDomains = ['google', 'facebook', 'amazon', 'apple', 'microsoft'];
            for (const popular of popularDomains) {
                // Check for similar but not exact domain names
                if (domain.includes(popular) && !domain.includes(`${popular}.com`)) {
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error('Error checking suspicious domain:', error);
            return false;
        }
    },
    
    // Extract URLs from text
    extractUrls(text) {
        if (!text) return [];
        
        // URL regex pattern
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const matches = text.match(urlRegex) || [];
        
        // Clean up the URLs
        return matches.map(url => {
            // Remove trailing punctuation that might be part of the matched URL but not the actual URL
            return url.replace(/[.,;:!?]$/, '');
        });
    }
};

// Export the service
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LinkValidator;
} else {
    window.LinkValidator = LinkValidator;
} 