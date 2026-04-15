import { Hono } from 'hono';
import { authMiddleware, getSessionFromContext } from '../middleware/auth';
import { notificationManager } from '../cache/notifications';
import type { NotificationFilter, NotificationSeverity, NotificationSource, NotificationStatus } from '../../shared/types/notification';

const notificationRoutes = new Hono();

/**
 * GET /api/notifications
 * Get all notifications with optional filtering
 */
notificationRoutes.get('/', authMiddleware, async (c) => {
  try {
    const source = c.req.query('source') as NotificationSource | undefined;
    const severity = c.req.query('severity') as NotificationSeverity | undefined;
    const status = c.req.query('status') as NotificationStatus | undefined;
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined;
    const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!) : undefined;

    const filter: NotificationFilter = {};
    if (source) filter.source = source;
    if (severity) filter.severity = severity;
    if (status) filter.status = status;
    if (limit) filter.limit = limit;
    if (offset) filter.offset = offset;

    const notifications = await notificationManager.getAllNotifications(filter);

    return c.json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return c.json(
      {
        success: false,
        message: 'Failed to fetch notifications',
      },
      500
    );
  }
});

/**
 * GET /api/notifications/unread
 * Get all unread notifications
 */
notificationRoutes.get('/unread', authMiddleware, async (c) => {
  try {
    const notifications = await notificationManager.getUnreadNotifications();

    return c.json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    console.error('Error fetching unread notifications:', error);
    return c.json(
      {
        success: false,
        message: 'Failed to fetch unread notifications',
      },
      500
    );
  }
});

/**
 * GET /api/notifications/stats
 * Get notification statistics
 */
notificationRoutes.get('/stats', authMiddleware, async (c) => {
  try {
    const stats = await notificationManager.getStats();

    return c.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    return c.json(
      {
        success: false,
        message: 'Failed to fetch stats',
      },
      500
    );
  }
});

/**
 * GET /api/notifications/count
 * Get unread notification count
 */
notificationRoutes.get('/count', authMiddleware, async (c) => {
  try {
    const unreadCount = await notificationManager.getUnreadCount();

    return c.json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error('Error fetching notification count:', error);
    return c.json(
      {
        success: false,
        message: 'Failed to fetch count',
      },
      500
    );
  }
});

/**
 * GET /api/notifications/:id
 * Get a specific notification
 */
notificationRoutes.get('/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const notification = await notificationManager.getNotification(id);

    if (!notification) {
      return c.json({ success: false, message: 'Notification not found' }, 404);
    }

    return c.json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error('Error fetching notification:', error);
    return c.json(
      {
        success: false,
        message: 'Failed to fetch notification',
      },
      500
    );
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read
 */
notificationRoutes.put('/:id/read', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const notification = await notificationManager.markAsRead(id);

    if (!notification) {
      return c.json({ success: false, message: 'Notification not found' }, 404);
    }

    return c.json({
      success: true,
      message: 'Notification marked as read',
      notification,
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return c.json(
      {
        success: false,
        message: 'Failed to mark as read',
      },
      500
    );
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
notificationRoutes.put('/read-all', authMiddleware, async (c) => {
  try {
    const count = await notificationManager.markAllAsRead();

    return c.json({
      success: true,
      message: `${count} notifications marked as read`,
      count,
    });
  } catch (error) {
    console.error('Error marking all as read:', error);
    return c.json(
      {
        success: false,
        message: 'Failed to mark all as read',
      },
      500
    );
  }
});

/**
 * PUT /api/notifications/:id/archive
 * Archive a notification
 */
notificationRoutes.put('/:id/archive', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const notification = await notificationManager.archiveNotification(id);

    if (!notification) {
      return c.json({ success: false, message: 'Notification not found' }, 404);
    }

    return c.json({
      success: true,
      message: 'Notification archived',
      notification,
    });
  } catch (error) {
    console.error('Error archiving notification:', error);
    return c.json(
      {
        success: false,
        message: 'Failed to archive notification',
      },
      500
    );
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification (admin only)
 */
notificationRoutes.delete('/:id', authMiddleware, async (c) => {
  try {
    const session = getSessionFromContext(c);
    if (!session?.isAdmin) {
      return c.json(
        {
          success: false,
          message: 'Unauthorized: Admin access required',
        },
        403
      );
    }

    const id = c.req.param('id');
    const deleted = await notificationManager.deleteNotification(id);

    if (!deleted) {
      return c.json({ success: false, message: 'Notification not found' }, 404);
    }

    return c.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return c.json(
      {
        success: false,
        message: 'Failed to delete notification',
      },
      500
    );
  }
});

/**
 * DELETE /api/notifications/archived
 * Clear all archived notifications (admin only)
 */
notificationRoutes.delete('/archived', authMiddleware, async (c) => {
  try {
    const session = getSessionFromContext(c);
    if (!session?.isAdmin) {
      return c.json(
        {
          success: false,
          message: 'Unauthorized: Admin access required',
        },
        403
      );
    }

    const count = await notificationManager.clearArchived();

    return c.json({
      success: true,
      message: `${count} archived notifications cleared`,
      count,
    });
  } catch (error) {
    console.error('Error clearing archived notifications:', error);
    return c.json(
      {
        success: false,
        message: 'Failed to clear archived notifications',
      },
      500
    );
  }
});

/**
 * POST /api/notifications (internal - for testing)
 * Create a test notification (admin only)
 */
notificationRoutes.post('/', authMiddleware, async (c) => {
  try {
    const session = getSessionFromContext(c);
    if (!session?.isAdmin) {
      return c.json(
        {
          success: false,
          message: 'Unauthorized: Admin access required',
        },
        403
      );
    }

    const body = await c.req.json();
    const { source, severity, title, message, metadata, actionUrl } = body;

    if (!source || !severity || !title || !message) {
      return c.json(
        {
          success: false,
          message: 'source, severity, title, and message are required',
        },
        400
      );
    }

    const notification = await notificationManager.addNotification({
      source,
      severity,
      title,
      message,
      metadata,
      actionUrl,
    });

    return c.json({
      success: true,
      message: 'Notification created',
      notification,
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    return c.json(
      {
        success: false,
        message: 'Failed to create notification',
      },
      500
    );
  }
});

export { notificationRoutes };
