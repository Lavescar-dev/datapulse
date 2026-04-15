import { Hono } from 'hono';
import { dashboardManager } from '../cache/dashboard';
import { widgetService } from '../services/dashboard/widgets';
import { getAllTemplates, getTemplateById } from '../services/dashboard/templates';
import { authMiddleware, getSessionFromContext } from '../middleware/auth';
import type { Dashboard, WidgetConfig } from '../../shared/types/dashboard';

const dashboardBuilderRoutes = new Hono();

dashboardBuilderRoutes.use('*', authMiddleware);

const requireAdmin = async (c: any, next: () => Promise<void>) => {
  const session = getSessionFromContext(c);

  if (!session.isAdmin) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  await next();
};

dashboardBuilderRoutes.get('/dashboards', async (c) => {
  try {
    const dashboards = await dashboardManager.getAllDashboards();
    return c.json({ dashboards, count: dashboards.length });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

dashboardBuilderRoutes.get('/dashboards/:id', async (c) => {
  try {
    const dashboard = await dashboardManager.getDashboard(c.req.param('id'));

    if (!dashboard) {
      return c.json({ error: 'Dashboard not found' }, 404);
    }

    return c.json(dashboard);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

dashboardBuilderRoutes.get('/templates', async (c) => {
  try {
    const templates = getAllTemplates();
    return c.json({ templates, count: templates.length });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

dashboardBuilderRoutes.get('/templates/:id', async (c) => {
  try {
    const template = getTemplateById(c.req.param('id'));

    if (!template) {
      return c.json({ error: 'Template not found' }, 404);
    }

    return c.json(template);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

dashboardBuilderRoutes.post('/dashboards/from-template/:templateId', async (c) => {
  try {
    const session = getSessionFromContext(c);
    const template = getTemplateById(c.req.param('templateId'));

    if (!template) {
      return c.json({ error: 'Template not found' }, 404);
    }

    const dashboard = await dashboardManager.createDashboard({
      name: template.name,
      description: template.description,
      widgets: JSON.parse(JSON.stringify(template.widgets)),
      isTemplate: false,
      createdBy: session.isAdmin ? 'admin' : 'demo',
    });

    return c.json(dashboard, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

dashboardBuilderRoutes.post('/dashboards', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const { name, description, widgets } = body;

    if (!name) {
      return c.json({ error: 'Dashboard name is required' }, 400);
    }

    const dashboard = await dashboardManager.createDashboard({
      name,
      description,
      widgets: Array.isArray(widgets) ? widgets : [],
      isTemplate: false,
      createdBy: 'admin',
    });

    return c.json(dashboard, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

dashboardBuilderRoutes.put('/dashboards/:id', async (c) => {
  try {
    const body = await c.req.json();
    const updates: Partial<Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.widgets !== undefined) updates.widgets = body.widgets;

    const updated = await dashboardManager.updateDashboard(c.req.param('id'), updates);

    if (!updated) {
      return c.json({ error: 'Dashboard not found' }, 404);
    }

    return c.json(updated);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

dashboardBuilderRoutes.delete('/dashboards/:id', requireAdmin, async (c) => {
  try {
    const deleted = await dashboardManager.deleteDashboard(c.req.param('id'));

    if (!deleted) {
      return c.json({ error: 'Dashboard not found' }, 404);
    }

    return c.json({ message: 'Dashboard deleted successfully' });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

dashboardBuilderRoutes.post('/dashboards/:id/widgets', async (c) => {
  try {
    const widget: WidgetConfig = await c.req.json();
    const updated = await dashboardManager.addWidget(c.req.param('id'), widget);

    if (!updated) {
      return c.json({ error: 'Dashboard not found' }, 404);
    }

    return c.json(updated);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

dashboardBuilderRoutes.delete('/dashboards/:id/widgets/:widgetId', async (c) => {
  try {
    const updated = await dashboardManager.removeWidget(c.req.param('id'), c.req.param('widgetId'));

    if (!updated) {
      return c.json({ error: 'Dashboard or widget not found' }, 404);
    }

    return c.json(updated);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

dashboardBuilderRoutes.post('/widgets/data', async (c) => {
  try {
    const widgets: WidgetConfig[] = await c.req.json();

    if (!Array.isArray(widgets)) {
      return c.json({ error: 'Expected array of widget configs' }, 400);
    }

    const resultMap = await widgetService.fetchMultipleWidgets(widgets);
    const results = widgets.map((widget) => {
      const data = resultMap.get(widget.id);

      return {
        widgetId: widget.id,
        data: data && !data.error ? data : undefined,
        error: data?.error,
      };
    });

    return c.json({ widgets: results });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

dashboardBuilderRoutes.post('/dashboards/:id/clone', async (c) => {
  try {
    const session = getSessionFromContext(c);
    const source = await dashboardManager.getDashboard(c.req.param('id'));

    if (!source) {
      return c.json({ error: 'Dashboard not found' }, 404);
    }

    const cloned = await dashboardManager.cloneDashboard(
      source.id,
      `${source.name} Copy`,
      session.isAdmin ? 'admin' : 'demo'
    );

    return c.json(cloned, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

dashboardBuilderRoutes.get('/dashboards/:id/export', async (c) => {
  try {
    const json = await dashboardManager.exportDashboard(c.req.param('id'));

    if (!json) {
      return c.json({ error: 'Dashboard not found' }, 404);
    }

    return c.json(JSON.parse(json));
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

dashboardBuilderRoutes.post('/dashboards/import', requireAdmin, async (c) => {
  try {
    const json = await c.req.text();
    const dashboard = await dashboardManager.importDashboard(json, 'admin');

    if (!dashboard) {
      return c.json({ error: 'Import failed' }, 400);
    }

    return c.json(dashboard, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export { dashboardBuilderRoutes };
