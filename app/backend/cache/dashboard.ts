import { existsSync } from 'fs';
import { join } from 'path';
import type { Dashboard, DashboardCache, WidgetConfig } from '../../shared/types/dashboard';

const CACHE_FILE_PATH = join(__dirname, 'dashboards.json');

/**
 * Dashboard layout manager
 * Handles storage and retrieval of user dashboards
 */
export class DashboardManager {
  private cache: DashboardCache | null = null;
  private initialized = false;

  /**
   * Initialize cache
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadFromFile();
      this.initialized = true;
      console.log('✓ Dashboard cache initialized');
    } catch (error) {
      console.error('Error initializing dashboard cache:', error);
      this.cache = { dashboards: [], lastUpdated: Date.now() };
      this.initialized = true;
    }
  }

  /**
   * Load cache from JSON file
   */
  private async loadFromFile(): Promise<void> {
    try {
      if (existsSync(CACHE_FILE_PATH)) {
        const file = Bun.file(CACHE_FILE_PATH);
        const data = await file.text();
        this.cache = JSON.parse(data);
        console.log(`✓ Loaded ${this.cache?.dashboards.length || 0} dashboards from cache`);
      } else {
        this.cache = { dashboards: [], lastUpdated: Date.now() };
      }
    } catch (error) {
      console.error('Error loading dashboards from file:', error);
      this.cache = { dashboards: [], lastUpdated: Date.now() };
    }
  }

  /**
   * Save cache to JSON file
   */
  private async saveToFile(): Promise<void> {
    try {
      await Bun.write(CACHE_FILE_PATH, JSON.stringify(this.cache, null, 2));
      console.log('✓ Saved dashboards to file');
    } catch (error) {
      console.error('Error saving dashboards to file:', error);
    }
  }

  /**
   * Get all dashboards
   */
  async getAllDashboards(): Promise<Dashboard[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.cache?.dashboards || [];
  }

  /**
   * Get dashboard by ID
   */
  async getDashboard(id: string): Promise<Dashboard | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.cache?.dashboards.find((d) => d.id === id) || null;
  }

  /**
   * Get dashboards by creator
   */
  async getDashboardsByCreator(createdBy: 'admin' | 'demo'): Promise<Dashboard[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.cache?.dashboards.filter((d) => d.createdBy === createdBy) || [];
  }

  /**
   * Get template dashboards
   */
  async getTemplateDashboards(): Promise<Dashboard[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.cache?.dashboards.filter((d) => d.isTemplate === true) || [];
  }

  /**
   * Create new dashboard
   */
  async createDashboard(
    data: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Dashboard> {
    if (!this.initialized) {
      await this.initialize();
    }

    const id = this.generateDashboardId();
    const now = new Date().toISOString();

    const newDashboard: Dashboard = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.cache!.dashboards.push(newDashboard);
    this.cache!.lastUpdated = Date.now();
    await this.saveToFile();

    console.log(`✓ Created dashboard: ${newDashboard.name}`);
    return newDashboard;
  }

  /**
   * Update existing dashboard
   */
  async updateDashboard(
    id: string,
    updates: Partial<Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Dashboard | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const dashboard = this.cache?.dashboards.find((d) => d.id === id);

    if (!dashboard) {
      return null;
    }

    // Update fields
    Object.assign(dashboard, updates);
    dashboard.updatedAt = new Date().toISOString();

    this.cache!.lastUpdated = Date.now();
    await this.saveToFile();

    console.log(`✓ Updated dashboard: ${dashboard.name}`);
    return dashboard;
  }

  /**
   * Update dashboard widgets
   */
  async updateWidgets(id: string, widgets: WidgetConfig[]): Promise<Dashboard | null> {
    return this.updateDashboard(id, { widgets });
  }

  /**
   * Add widget to dashboard
   */
  async addWidget(id: string, widget: WidgetConfig): Promise<Dashboard | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const dashboard = this.cache?.dashboards.find((d) => d.id === id);

    if (!dashboard) {
      return null;
    }

    // Check if widget with same ID already exists
    const existingIndex = dashboard.widgets.findIndex((w) => w.id === widget.id);

    if (existingIndex >= 0) {
      // Replace existing widget
      dashboard.widgets[existingIndex] = widget;
    } else {
      // Add new widget
      dashboard.widgets.push(widget);
    }

    dashboard.updatedAt = new Date().toISOString();
    this.cache!.lastUpdated = Date.now();
    await this.saveToFile();

    console.log(`✓ Added/updated widget in dashboard: ${dashboard.name}`);
    return dashboard;
  }

  /**
   * Remove widget from dashboard
   */
  async removeWidget(dashboardId: string, widgetId: string): Promise<Dashboard | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const dashboard = this.cache?.dashboards.find((d) => d.id === dashboardId);

    if (!dashboard) {
      return null;
    }

    const initialLength = dashboard.widgets.length;
    dashboard.widgets = dashboard.widgets.filter((w) => w.id !== widgetId);

    if (dashboard.widgets.length < initialLength) {
      dashboard.updatedAt = new Date().toISOString();
      this.cache!.lastUpdated = Date.now();
      await this.saveToFile();

      console.log(`✓ Removed widget from dashboard: ${dashboard.name}`);
      return dashboard;
    }

    return null;
  }

  /**
   * Delete dashboard
   */
  async deleteDashboard(id: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    const initialLength = this.cache!.dashboards.length;
    this.cache!.dashboards = this.cache!.dashboards.filter((d) => d.id !== id);

    if (this.cache!.dashboards.length < initialLength) {
      this.cache!.lastUpdated = Date.now();
      await this.saveToFile();
      console.log(`✓ Deleted dashboard: ${id}`);
      return true;
    }

    return false;
  }

  /**
   * Clone dashboard (useful for creating from templates)
   */
  async cloneDashboard(
    sourceId: string,
    newName: string,
    createdBy?: 'admin' | 'demo'
  ): Promise<Dashboard | null> {
    const source = await this.getDashboard(sourceId);

    if (!source) {
      return null;
    }

    // Create deep copy of widgets
    const clonedWidgets = JSON.parse(JSON.stringify(source.widgets));

    return this.createDashboard({
      name: newName,
      description: source.description,
      widgets: clonedWidgets,
      isTemplate: false,
      createdBy: createdBy || source.createdBy,
    });
  }

  /**
   * Generate unique dashboard ID
   */
  private generateDashboardId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `dashboard-${timestamp}-${random}`;
  }

  /**
   * Get cache metadata
   */
  async getCacheMetadata(): Promise<{
    totalDashboards: number;
    templateDashboards: number;
    adminDashboards: number;
    demoDashboards: number;
    lastUpdated: number;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    const dashboards = this.cache?.dashboards || [];

    return {
      totalDashboards: dashboards.length,
      templateDashboards: dashboards.filter((d) => d.isTemplate === true).length,
      adminDashboards: dashboards.filter((d) => d.createdBy === 'admin').length,
      demoDashboards: dashboards.filter((d) => d.createdBy === 'demo').length,
      lastUpdated: this.cache?.lastUpdated || 0,
    };
  }

  /**
   * Export dashboard to JSON
   */
  async exportDashboard(id: string): Promise<string | null> {
    const dashboard = await this.getDashboard(id);

    if (!dashboard) {
      return null;
    }

    return JSON.stringify(dashboard, null, 2);
  }

  /**
   * Import dashboard from JSON
   */
  async importDashboard(
    jsonData: string,
    createdBy?: 'admin' | 'demo'
  ): Promise<Dashboard | null> {
    try {
      const data = JSON.parse(jsonData);

      // Validate basic structure
      if (!data.name || !data.widgets || !Array.isArray(data.widgets)) {
        throw new Error('Invalid dashboard data');
      }

      return this.createDashboard({
        name: data.name,
        description: data.description,
        widgets: data.widgets,
        isTemplate: false,
        createdBy: createdBy || 'demo',
      });
    } catch (error) {
      console.error('Error importing dashboard:', error);
      return null;
    }
  }
}

export const dashboardManager = new DashboardManager();
