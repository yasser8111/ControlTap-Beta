/**
 * SearchEngine
 * Handles advanced search suggestions merging exact matches, custom sites, and browser history.
 */
class SearchEngine {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this._sitesCache = null;
    this._currentAbortController = null;
  }

  async getSuggestions(query) {
    if (!query) return [];

    // Cancel any pending history search
    if (this._currentAbortController) {
      this._currentAbortController.abort();
    }
    this._currentAbortController = new AbortController();
    const signal = this._currentAbortController.signal;

    const lowerQuery = query.toLowerCase();
    const settings = this.stateManager.getState().settings;
    const isHistorySearchEnabled = settings.enableHistorySearch !== false;

    let suggestions = [];
    const seenUrls = new Set();

    const addSuggestion = (sug) => {
      if (sug.url && sug.url !== "search_action") {
        if (seenUrls.has(sug.url)) return;
        seenUrls.add(sug.url);
      }
      suggestions.push(sug);
    };

    // 1. Direct Match / URL Detection
    const isDirectUrl = /^https?:\/\//i.test(query) || /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}/i.test(query);
    suggestions.push({
      type: isDirectUrl ? "site" : "search",
      text: query,
      url: isDirectUrl ? (query.startsWith('http') ? query : `https://${query}`) : "search_action"
    });

    // Lazy load / Cache sites
    if (!this._sitesCache) {
      this._sitesCache = this._getAllCustomSites();
    }
    const allSites = this._sitesCache;

    // Search Cached Sites (Exact/Prefix matches)
    for (const site of allSites) {
      const nLower = site.name.toLowerCase();
      const uLower = site.url.toLowerCase();
      const cleanUrl = uLower.replace(/^https?:\/\/(www\.)?/, '');
      
      if (nLower.startsWith(lowerQuery) || cleanUrl.startsWith(lowerQuery)) {
        addSuggestion({
          type: "exact_site",
          text: site.name,
          url: site.url,
          originalMatch: true
        });
      }
    }

    // Partial Matches (Contains matches)
    const partials = allSites.filter(site => {
      const nLower = site.name.toLowerCase();
      const uLower = site.url.toLowerCase();
      const cleanUrl = uLower.replace(/^https?:\/\/(www\.)?/, '');
      return (nLower.includes(lowerQuery) || cleanUrl.includes(lowerQuery)) && 
             !(nLower.startsWith(lowerQuery) || cleanUrl.startsWith(lowerQuery));
    }).slice(0, 3);

    partials.forEach(site => addSuggestion({ type: "site", text: site.name, url: site.url }));

    // 3. Browser History (Async)
    if (isHistorySearchEnabled && typeof chrome !== "undefined" && chrome.history) {
      try {
        const historyResults = await new Promise((resolve, reject) => {
          chrome.history.search({ text: query, maxResults: 100 }, (results) => {
            if (signal.aborted) return reject(new Error("Aborted"));
            resolve(results || []);
          });
        });

        historyResults.sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0));
        historyResults.slice(0, 50).forEach(item => {
          addSuggestion({ type: "history", text: item.title || item.url, url: item.url });
        });
      } catch (e) {
        if (e.message !== "Aborted") console.error("History search failed", e);
      }
    }
    
    // fallback historical recent searches from local state
    const stateHistory = this.stateManager.getState().searchHistory || [];
    const matchedStateHistory = stateHistory.filter(h => h.toLowerCase().includes(lowerQuery) && h.toLowerCase() !== lowerQuery).slice(0, 10);
    matchedStateHistory.forEach(h => {
        addSuggestion({ type: "search_history", text: h, url: "search_action" });
    });

    return suggestions.slice(0, 50);
  }

  /**
   * Invalidates the site cache so it's rebuilt on next search.
   * Call this whenever sites are added/removed/renamed.
   */
  invalidateCache() {
    this._sitesCache = null;
  }

  _getAllCustomSites() {
    const sites = [];
    const state = this.stateManager.getState();
    if (state && state.pages) {
      state.pages.forEach(page => {
        page.groups?.forEach(group => {
          group.sites?.forEach(site => sites.push(site));
        });
      });
    }
    return sites;
  }
}
