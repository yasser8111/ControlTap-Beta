/**
 * StateManager
 * Interacts with LocalStorage and manages application settings/records.
 */
class StateManager {
  constructor() {
    this.state = this._loadState();
    this._normalizeState();
  }

  _loadState() {
    try {
      const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.error("Failed to parse state", e);
      return null;
    }
  }

  _normalizeState() {
    if (!this.state) {
      this.state = {
        settings: {
          bgType: "videoUrl",
          bgImage: "backgrounds/1111.mp4",
          primaryColor: "#FF2E32",
          cardOpacity: 0.0,
          themeMode: "dark",
        },
        pages: [
          {
            id: `page-home`,
            title: typeof window !== 'undefined' && window.TRANSLATIONS ? (window.TRANSLATIONS[this.language || 'ar']?.home_page || "Home") : "Home",
            groups: [
              {
                id: `group-1`,
                title: "المواقع المفضلة",
                column: 0,
                order: 0,
                sites: [
                  { id: "site-1", name: "Google", url: "https://google.com" },
                  { id: "site-2", name: "YouTube", url: "https://youtube.com" },
                  { id: "site-3", name: "GitHub", url: "https://github.com" },
                ],
              },
            ],
          }
        ],
        activePageId: `page-home`,
        customTemplates: [],
      };
    }

    if (this.state.groups && !this.state.pages) {
      this.state.pages = [
        {
          id: `page-home`,
          title: "Home",
          groups: this.state.groups
        }
      ];
      this.state.activePageId = `page-home`;
      delete this.state.groups;
    }

    this.state.customTemplates ??= [];

    this.state.settings.bgType ??= "preset";
    this.state.settings.themeMode ??= "light";
    if (this.state.settings.cardOpacity === "0.8") {
      this.state.settings.cardOpacity = "0.25";
    }
    this.state.settings.columnsCount ??= 6;
    this.state.settings.cardSize ??= 100;
    this.state.settings.simpleMode ??= false;
    this.state.settings.openInNewTab ??= false;
    this.state.settings.language ??= "ar";

    const colCount = this.state.settings.columnsCount;
    this.state.pages.forEach(page => {
      page.groups.forEach((g, i) => {
        g.column ??= i % colCount;
        if (g.column >= colCount) {
          g.column = colCount - 1;
        }
        g.order ??= i;
      });
    });

    this.sortGroups();
  }

  sortGroups() {
    this.state.pages.forEach(page => {
      page.groups.sort((a, b) => {
        return a.column === b.column ? a.order - b.order : a.column - b.column;
      });
    });
  }

  save() {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.state));
  }

  getState() {
    return this.state;
  }
}
