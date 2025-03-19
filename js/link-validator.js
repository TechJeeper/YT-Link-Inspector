// Link Validator Service
const LinkValidator = {
    // Function to validate multiple links simultaneously
    async validateLinks(links) {
        const promises = links.map(link => this.validateLink(link));
        return Promise.all(promises);
    },
    
    // Function to validate a single link
    async validateLink(url) {
        try {
            // In a full implementation, we would make a real HTTP request
            // For this demo/prototype, we'll use a proxy or simulate the check
            
            // For a real implementation on GitHub pages, we'd need to use a proxy service
            // as direct CORS requests to arbitrary URLs won't work.
            // Example: const response = await fetch(`https://your-proxy-service.com/check?url=${encodeURIComponent(url)}`);
            
            // Simulate a validation check with varying response times
            await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 1000));
            
            // For demo purposes, we'll determine the status based on URL patterns
            let status = 'valid';
            let statusText = 'Valid Link';
            let statusCode = 200;
            
            // Simulate different link statuses based on URL patterns
            if (url.includes('broken') || url.includes('404')) {
                status = 'broken';
                statusText = 'Broken Link (404 Not Found)';
                statusCode = 404;
            } else if (url.includes('parked-domain') || url.includes('.xyz')) {
                status = 'suspicious';
                statusText = 'Parked Domain';
                statusCode = 200;
            } else if (url.includes('suspicious') || url.match(/\.(biz|info|top)($|\/)/)) {
                status = 'suspicious';
                statusText = 'Suspicious Domain';
                statusCode = 200;
            } else if (url.includes('timeout') || url.includes('slow')) {
                status = 'broken';
                statusText = 'Connection Timeout';
                statusCode = 408;
            } else if (Math.random() < 0.1) {
                // Randomly mark some links as broken (10% chance)
                status = 'broken';
                statusText = 'Connection Failed';
                statusCode = 503;
            }
            
            return {
                url,
                status,
                statusText,
                statusCode
            };
            
        } catch (error) {
            console.error('Error validating link:', url, error);
            
            return {
                url,
                status: 'broken',
                statusText: 'Error checking link',
                statusCode: 0,
                error: error.message
            };
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