// Link Validator Service
const LinkValidator = {
    // Function to validate multiple links simultaneously
    async validateLinks(links) {
        const promises = links.map(link => this.validateLink(link));
        return Promise.all(promises);
    },
    
    // Function to validate a single link with retries
    async validateLink(url, maxRetries = 3) {
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Make a real HTTP HEAD request to check the link
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
                
                try {
                    const response = await fetch(url, {
                        method: 'HEAD',
                        redirect: 'follow',
                        mode: 'no-cors', // This allows checking external URLs
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeout);
                    
                    // Since we're using no-cors, we won't get status codes
                    // But if we reach here, the request didn't fail
                    return {
                        url,
                        status: 'valid',
                        statusText: 'Valid Link',
                        statusCode: 200,
                        attempts: attempt
                    };
                    
                } catch (fetchError) {
                    clearTimeout(timeout);
                    
                    // Try a GET request as fallback (some servers don't support HEAD)
                    try {
                        const getResponse = await fetch(url, {
                            method: 'GET',
                            redirect: 'follow',
                            mode: 'no-cors', // This allows checking external URLs
                            signal: controller.signal
                        });
                        
                        return {
                            url,
                            status: 'valid',
                            statusText: 'Valid Link',
                            statusCode: 200,
                            attempts: attempt
                        };
                        
                    } catch (getError) {
                        // If both HEAD and GET fail, throw the error
                        throw getError;
                    }
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
                
                // If this is the last attempt, return the error result
                if (attempt === maxRetries) {
                    let statusText = 'Connection Failed';
                    
                    // Determine more specific error messages
                    if (error.message.includes('ENOTFOUND') || error.message.includes('not found')) {
                        statusText = 'Domain Not Found';
                    } else if (error.message.includes('ECONNREFUSED')) {
                        statusText = 'Connection Refused';
                    } else if (error.message.includes('certificate')) {
                        statusText = 'SSL Certificate Error';
                    }
                    
                    return {
                        url,
                        status: 'broken',
                        statusText: `${statusText} (${maxRetries} attempts failed)`,
                        statusCode: 0,
                        error: error.message,
                        attempts: attempt
                    };
                }
                
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }
        
        // This should never be reached due to the return in the last attempt
        return {
            url,
            status: 'broken',
            statusText: 'Unexpected error during validation',
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