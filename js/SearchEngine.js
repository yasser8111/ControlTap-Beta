/**
 * SearchEngine
 * Handles advanced search suggestions merging exact matches, custom sites, and browser history.
 */
class SearchEngine {
  constructor(stateManager) {
    this.stateManager = stateManager;
  }

  async getSuggestions(query) {
    if (!query) return [];

    const lowerQuery = query.toLowerCase();
    const settings = this.stateManager.getState().settings;
    const isHistorySearchEnabled = settings.enableHistorySearch !== false; // default true

    let suggestions = [];
    const seenUrls = new Set();

    // Utility to avoid duplicates
    const addSuggestion = (sug) => {
        if (sug.url && sug.url !== "search_action") {
            if (seenUrls.has(sug.url)) return;
            seenUrls.add(sug.url);
        }
        suggestions.push(sug);
    };

    // 1. Exact Match (Top priority)
    // Detect if the query is a direct URL
    const isDirectUrl = /^https?:\/\//i.test(query) || /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}/i.test(query);

    suggestions.push({
      type: isDirectUrl ? "site" : "search",
      text: query,
      url: isDirectUrl ? (query.startsWith('http') ? query : `https://${query}`) : "search_action"
    });

    const allSites = this._getAllCustomSites();

    // Check custom sites for Exact Match (title or url starts with text)
    allSites.forEach(site => {
        const nLower = site.name.toLowerCase();
        const uLower = site.url.toLowerCase();
        // Remove https/http/www for url matching to make it more natural
        const cleanUrl = uLower.replace(/^https?:\/\/(www\.)?/, '');
        
        if (nLower.startsWith(lowerQuery) || cleanUrl.startsWith(lowerQuery)) {
            addSuggestion({
                type: "exact_site",
                text: site.name,
                url: site.url,
                originalMatch: true
            });
        }
    });

    // 2. Custom Sites (Partial matches that are not exact matches)
    const partialSiteMatches = allSites.filter(site => {
        const nLower = site.name.toLowerCase();
        const uLower = site.url.toLowerCase();
        const cleanUrl = uLower.replace(/^https?:\/\/(www\.)?/, '');

        const isIncludes = nLower.includes(lowerQuery) || cleanUrl.includes(lowerQuery);
        const isNotExact = !(nLower.startsWith(lowerQuery) || cleanUrl.startsWith(lowerQuery));
        return isIncludes && isNotExact;
    }).slice(0, 3);

    partialSiteMatches.forEach(site => {
        addSuggestion({
            type: "site",
            text: site.name,
            url: site.url
        });
    });

    // 3. Browser History
    if (isHistorySearchEnabled && typeof chrome !== "undefined" && chrome.history) {
        try {
            const historyResults = await new Promise(resolve => {
                chrome.history.search({ text: query, maxResults: 15 }, (results) => {
                    resolve(results || []);
                });
            });

            // Sort by most visited or recently visited (chrome.history.search already returns sorted by default score/recency)
            // but we can prioritize visit count
            historyResults.sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0));

            historyResults.slice(0, 7).forEach(item => {
                addSuggestion({
                    type: "history",
                    text: item.title || item.url,
                    url: item.url
                });
            });
        } catch (e) {
            console.error("Failed to fetch chrome history", e);
        }
    }

    // fallback historical recent searches from local state if history API didn't return much
    const stateHistory = this.stateManager.getState().searchHistory || [];
    const matchedStateHistory = stateHistory.filter(h => h.toLowerCase().includes(lowerQuery) && h.toLowerCase() !== lowerQuery).slice(0, 3);
    matchedStateHistory.forEach(h => {
        addSuggestion({
            type: "search_history",
            text: h,
            url: "search_action"
        });
    });

    // Return max 10 to keep it clean
    return suggestions.slice(0, 10);
  }

  _getAllCustomSites() {
    const sites = [];
    const state = this.stateManager.getState();
    if (state && state.pages) {
        state.pages.forEach(page => {
            if (page.groups) {
                page.groups.forEach(group => {
                    if (group.sites) {
                        group.sites.forEach(site => sites.push(site));
                    }
                });
            }
        });
    }
    return sites;
  }
}
