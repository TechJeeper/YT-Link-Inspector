// Link Validator Service
const LinkValidator = {
    // Known sites that block HEAD/GET requests but are typically valid
    knownValidDomains: [
        'walmart.com', 'ebay.com', 'ebay.co.uk',
        'bestbuy.com', 'target.com'
    ],

    // Amazon domains for product checking
    amazonDomains: [
        'amazon.com', 'amazon.co.uk', 'amazon.ca', 'amzn.to'
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
            // First check if this is a known valid domain or Amazon
            const urlObj = new URL(url);
            const domain = urlObj.hostname.toLowerCase();
            
            // Check if it's an Amazon domain
            const isAmazon = this.amazonDomains.some(known => 
                domain === known || domain.endsWith('.' + known)
            );
            
            if (isAmazon) {
                return await this.checkAmazonProduct(url, maxRetries);
            }
            
            // Check other known valid domains
            const isKnownDomain = this.knownValidDomains.some(known => 
                domain === known || domain.endsWith('.' + known)
            );
            
            if (isKnownDomain) {
                return {
                    url,
                    status: 'valid',
                    statusText: 'Valid Link (Known Domain)',
                    statusCode: 200,
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
                    const response = await fetch(url, {
                        method: 'HEAD',
                        redirect: 'follow',
                        signal: controller.signal,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (compatible; LinkChecker/1.0)'
                        }
                    });
                    
                    clearTimeout(timeout);
                    
                    // Check if we got a 405 Method Not Allowed
                    if (response.status === 405) {
                        // Try GET request instead
                        return await this.fallbackToGet(url, controller);
                    }
                    
                    // Handle other response statuses
                    if (response.ok) {
                        return {
                            url,
                            status: 'valid',
                            statusText: 'Valid Link',
                            statusCode: response.status,
                            attempts: attempt
                        };
                    } else {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    
                } catch (fetchError) {
                    clearTimeout(timeout);
                    
                    // If it's a 405 or network error, try GET
                    if (fetchError.message.includes('405') || !fetchError.message.includes('HTTP')) {
                        try {
                            return await this.fallbackToGet(url, controller);
                        } catch (getError) {
                            throw getError;
                        }
                    }
                    
                    throw fetchError;
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
                    let statusCode = 0;
                    
                    // Determine more specific error messages
                    if (error.message.includes('ENOTFOUND') || error.message.includes('not found')) {
                        statusText = 'Domain Not Found';
                    } else if (error.message.includes('ECONNREFUSED')) {
                        statusText = 'Connection Refused';
                    } else if (error.message.includes('certificate')) {
                        statusText = 'SSL Certificate Error';
                    } else if (error.message.startsWith('HTTP ')) {
                        // Extract status code from HTTP error
                        statusCode = parseInt(error.message.split(' ')[1]);
                        switch (statusCode) {
                            case 404:
                                statusText = 'Page Not Found';
                                break;
                            case 403:
                                statusText = 'Access Forbidden';
                                break;
                            case 500:
                                statusText = 'Server Error';
                                break;
                            default:
                                statusText = `HTTP Error ${statusCode}`;
                        }
                    }
                    
                    return {
                        url,
                        status: 'broken',
                        statusText: `${statusText} (${maxRetries} attempts failed)`,
                        statusCode: statusCode,
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
    
    // Check Amazon product availability
    async checkAmazonProduct(url, maxRetries = 3) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                redirect: 'follow',
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            
            clearTimeout(timeout);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const text = await response.text();
            
            // Check for common "product not available" patterns
            const unavailablePatterns = [
                'Currently unavailable',
                'We don\'t know when or if this item will be back in stock',
                'This page no longer exists',
                'Looking for something?',
                'We couldn\'t find that page',
                'The Web address you entered is not a functioning page on our site'
            ];
            
            const hasUnavailablePattern = unavailablePatterns.some(pattern => 
                text.includes(pattern)
            );
            
            if (hasUnavailablePattern) {
                return {
                    url,
                    status: 'broken',
                    statusText: 'Product No Longer Available',
                    statusCode: 200,
                    attempts: 1
                };
            }
            
            return {
                url,
                status: 'valid',
                statusText: 'Product Available',
                statusCode: 200,
                attempts: 1
            };
            
        } catch (error) {
            clearTimeout(timeout);
            console.error('Error checking Amazon product:', error);
            
            // Return a more specific error for Amazon products
            return {
                url,
                status: 'broken',
                statusText: 'Unable to Check Product Availability',
                statusCode: error.message.startsWith('HTTP') ? parseInt(error.message.split(' ')[1]) : 0,
                error: error.message,
                attempts: 1
            };
        }
    },
    
    // Fallback to GET request
    async fallbackToGet(url, controller) {
        const getResponse = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; LinkChecker/1.0)'
            }
        });
        
        if (getResponse.ok) {
            return {
                url,
                status: 'valid',
                statusText: 'Valid Link',
                statusCode: getResponse.status,
                attempts: 1
            };
        } else {
            throw new Error(`HTTP ${getResponse.status}`);
        }
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