import { logger } from '@/lib/monitoring/logger'
import { memoryManager } from '@/lib/memory/memory-manager'

export interface AlertRule {
  id: string
  name: string
  description: string
  condition: (metrics: AlertMetrics) => boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
  cooldownMs: number
  channels: AlertChannel[]
  enabled: boolean
}

export interface AlertMetrics {
  // Memory metrics
  heapUsedMB: number
  heapTotalMB: number
  memoryUsagePercent: number
  
  // Performance metrics
  averageResponseTime: number
  activeRequests: number
  
  // Error metrics
  errorRate: number
  errorCount: number
  
  // Rate limiting metrics
  rateLimitViolations: number
  
  // Authentication metrics
  authFailures: number
  
  // System metrics
  uptime: number
  cpuUsage: number
  
  // Custom metrics
  claudeOperationFailures: number
  e2bSandboxFailures: number
  githubIntegrationFailures: number
  deploymentFailures: number
}

export interface AlertChannel {
  type: 'webhook' | 'email' | 'slack' | 'discord' | 'pagerduty'
  config: Record<string, any>
  enabled: boolean
}

export interface Alert {
  id: string
  ruleId: string
  ruleName: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  metrics: AlertMetrics
  timestamp: Date
  resolved: boolean
  resolvedAt?: Date
}

/**
 * Proactive Alert Manager
 * Monitors system metrics and sends alerts when thresholds are breached
 */
export class AlertManager {
  private static instance: AlertManager
  private alerts: Map<string, Alert> = new Map()
  private lastAlertTime: Map<string, number> = new Map()
  private monitoringInterval: NodeJS.Timeout | null = null
  private alertRules: AlertRule[] = []
  private metrics: AlertMetrics = this.getDefaultMetrics()

  constructor() {
    this.setupDefaultAlertRules()
    this.startMonitoring()
  }

  static getInstance(): AlertManager {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager()
    }
    return AlertManager.instance
  }

  /**
   * Start monitoring and alerting
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      return
    }

    this.monitoringInterval = setInterval(async () => {
      await this.checkAlertRules()
    }, 30000) // Check every 30 seconds

    logger.info('Alert monitoring started')
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    logger.info('Alert monitoring stopped')
  }

  /**
   * Add or update alert rule
   */
  addAlertRule(rule: AlertRule): void {
    const existingIndex = this.alertRules.findIndex(r => r.id === rule.id)
    if (existingIndex >= 0) {
      this.alertRules[existingIndex] = rule
    } else {
      this.alertRules.push(rule)
    }

    logger.info('Alert rule added/updated', {
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        enabled: rule.enabled
      }
    })
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): void {
    this.alertRules = this.alertRules.filter(rule => rule.id !== ruleId)
    this.lastAlertTime.delete(ruleId)

    logger.info('Alert rule removed', { metadata: { ruleId } })
  }

  /**
   * Update metrics (called by monitoring systems)
   */
  updateMetrics(newMetrics: Partial<AlertMetrics>): void {
    this.metrics = { ...this.metrics, ...newMetrics }
  }

  /**
   * Manually trigger alert
   */
  async triggerAlert(
    ruleId: string,
    message: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    additionalMetrics?: Partial<AlertMetrics>
  ): Promise<void> {
    const alert: Alert = {
      id: `manual-${Date.now()}`,
      ruleId,
      ruleName: `Manual Alert - ${ruleId}`,
      severity,
      message,
      metrics: { ...this.metrics, ...additionalMetrics },
      timestamp: new Date(),
      resolved: false
    }

    await this.sendAlert(alert)
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.alerts.get(alertId)
    if (alert && !alert.resolved) {
      alert.resolved = true
      alert.resolvedAt = new Date()
      
      await this.sendAlertResolution(alert)
      
      logger.info('Alert resolved', {
        metadata: {
          alertId,
          ruleId: alert.ruleId,
          duration: alert.resolvedAt.getTime() - alert.timestamp.getTime()
        }
      })
    }
  }

  /**
   * Get current alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved)
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 100): Alert[] {
    return Array.from(this.alerts.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
  }

  /**
   * Get alert statistics
   */
  getAlertStats(): {
    totalAlerts: number
    activeAlerts: number
    criticalAlerts: number
    averageResolutionTime: number
    topAlertRules: Array<{ ruleId: string; count: number }>
  } {
    const alerts = Array.from(this.alerts.values())
    const activeAlerts = alerts.filter(a => !a.resolved)
    const criticalAlerts = alerts.filter(a => a.severity === 'critical')
    
    // Calculate average resolution time
    const resolvedAlerts = alerts.filter(a => a.resolved && a.resolvedAt)
    const totalResolutionTime = resolvedAlerts.reduce((sum, alert) => {
      return sum + (alert.resolvedAt!.getTime() - alert.timestamp.getTime())
    }, 0)
    const averageResolutionTime = resolvedAlerts.length > 0 
      ? totalResolutionTime / resolvedAlerts.length 
      : 0

    // Top alert rules
    const ruleCount = new Map<string, number>()
    alerts.forEach(alert => {
      const count = ruleCount.get(alert.ruleId) || 0
      ruleCount.set(alert.ruleId, count + 1)
    })
    
    const topAlertRules = Array.from(ruleCount.entries())
      .map(([ruleId, count]) => ({ ruleId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      totalAlerts: alerts.length,
      activeAlerts: activeAlerts.length,
      criticalAlerts: criticalAlerts.length,
      averageResolutionTime: Math.round(averageResolutionTime),
      topAlertRules
    }
  }

  // Private methods

  private async checkAlertRules(): Promise<void> {
    try {
      // Update current metrics
      await this.updateCurrentMetrics()

      // Check each alert rule
      for (const rule of this.alertRules) {
        if (!rule.enabled) {
          continue
        }

        const shouldAlert = rule.condition(this.metrics)
        const lastAlertTime = this.lastAlertTime.get(rule.id) || 0
        const now = Date.now()

        if (shouldAlert && (now - lastAlertTime) > rule.cooldownMs) {
          await this.triggerRuleAlert(rule)
          this.lastAlertTime.set(rule.id, now)
        }
      }
    } catch (error) {
      logger.error('Failed to check alert rules', error instanceof Error ? error : new Error(String(error)))
    }
  }

  private async updateCurrentMetrics(): Promise<void> {
    try {
      // Memory metrics
      const memStats = memoryManager.getMemoryStats()
      const memoryUsagePercent = (memStats.heapUsed / memStats.heapTotal) * 100

      // System metrics
      const cpuUsage = process.cpuUsage()
      const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000 / process.uptime() * 100

      this.metrics = {
        ...this.metrics,
        heapUsedMB: memStats.heapUsed,
        heapTotalMB: memStats.heapTotal,
        memoryUsagePercent,
        uptime: process.uptime(),
        cpuUsage: Math.min(cpuPercent, 100) // Cap at 100%
      }
    } catch (error) {
      logger.error('Failed to update metrics', error instanceof Error ? error : new Error(String(error)))
    }
  }

  private async triggerRuleAlert(rule: AlertRule): Promise<void> {
    const alert: Alert = {
      id: `${rule.id}-${Date.now()}`,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message: `Alert: ${rule.name} - ${rule.description}`,
      metrics: { ...this.metrics },
      timestamp: new Date(),
      resolved: false
    }

    this.alerts.set(alert.id, alert)
    await this.sendAlert(alert)

    logger.warn('Alert triggered', {
      metadata: {
        alertId: alert.id,
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity
      }
    })
  }

  private async sendAlert(alert: Alert): Promise<void> {
    const rule = this.alertRules.find(r => r.id === alert.ruleId)
    if (!rule) {
      return
    }

    for (const channel of rule.channels) {
      if (!channel.enabled) {
        continue
      }

      try {
        await this.sendToChannel(channel, alert)
      } catch (error) {
        logger.error('Failed to send alert to channel', error instanceof Error ? error : new Error(String(error)), {
          metadata: {
            channelType: channel.type,
            alertId: alert.id
          }
        })
      }
    }
  }

  private async sendAlertResolution(alert: Alert): Promise<void> {
    const rule = this.alertRules.find(r => r.id === alert.ruleId)
    if (!rule) {
      return
    }

    for (const channel of rule.channels) {
      if (!channel.enabled) {
        continue
      }

      try {
        await this.sendResolutionToChannel(channel, alert)
      } catch (error) {
        logger.error('Failed to send alert resolution to channel', error instanceof Error ? error : new Error(String(error)), {
          metadata: {
            channelType: channel.type,
            alertId: alert.id
          }
        })
      }
    }
  }

  private async sendToChannel(channel: AlertChannel, alert: Alert): Promise<void> {
    switch (channel.type) {
      case 'webhook':
        await this.sendWebhook(channel.config, alert)
        break
      case 'slack':
        await this.sendSlack(channel.config, alert)
        break
      case 'discord':
        await this.sendDiscord(channel.config, alert)
        break
      case 'email':
        await this.sendEmail(channel.config, alert)
        break
      case 'pagerduty':
        await this.sendPagerDuty(channel.config, alert)
        break
      default:
        logger.warn('Unknown alert channel type', { metadata: { type: channel.type } })
    }
  }

  private async sendResolutionToChannel(channel: AlertChannel, alert: Alert): Promise<void> {
    // Similar to sendToChannel but for resolutions
    const resolutionMessage = `✅ RESOLVED: ${alert.message}`
    const resolutionAlert = { ...alert, message: resolutionMessage }
    
    await this.sendToChannel(channel, resolutionAlert)
  }

  private async sendWebhook(config: any, alert: Alert): Promise<void> {
    if (!config.url) {
      throw new Error('Webhook URL not configured')
    }

    const payload = {
      alert: {
        id: alert.id,
        severity: alert.severity,
        message: alert.message,
        timestamp: alert.timestamp.toISOString(),
        metrics: alert.metrics
      },
      platform: 'PRIA',
      environment: process.env.NODE_ENV || 'development'
    }

    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.headers || {})
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`)
    }
  }

  private async sendSlack(config: any, alert: Alert): Promise<void> {
    if (!config.webhookUrl) {
      throw new Error('Slack webhook URL not configured')
    }

    const color = this.getSeverityColor(alert.severity)
    const emoji = this.getSeverityEmoji(alert.severity)

    const payload = {
      text: `${emoji} PRIA Platform Alert`,
      attachments: [{
        color,
        fields: [
          { title: 'Alert', value: alert.message, short: false },
          { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
          { title: 'Time', value: alert.timestamp.toISOString(), short: true },
          { title: 'Memory Usage', value: `${alert.metrics.heapUsedMB}MB`, short: true },
          { title: 'Error Rate', value: `${alert.metrics.errorRate}%`, short: true }
        ]
      }]
    }

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.status}`)
    }
  }

  private async sendDiscord(config: any, alert: Alert): Promise<void> {
    if (!config.webhookUrl) {
      throw new Error('Discord webhook URL not configured')
    }

    const color = this.getSeverityColorDiscord(alert.severity)
    const emoji = this.getSeverityEmoji(alert.severity)

    const payload = {
      content: `${emoji} **PRIA Platform Alert**`,
      embeds: [{
        title: alert.message,
        color,
        fields: [
          { name: 'Severity', value: alert.severity.toUpperCase(), inline: true },
          { name: 'Time', value: alert.timestamp.toISOString(), inline: true },
          { name: 'Memory Usage', value: `${alert.metrics.heapUsedMB}MB`, inline: true },
          { name: 'Error Rate', value: `${alert.metrics.errorRate}%`, inline: true }
        ],
        timestamp: alert.timestamp.toISOString()
      }]
    }

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.status}`)
    }
  }

  private async sendEmail(config: any, alert: Alert): Promise<void> {
    // Email implementation would require email service integration
    logger.info('Email alert would be sent', {
      metadata: {
        to: config.to,
        subject: `PRIA Alert: ${alert.severity.toUpperCase()}`,
        alertId: alert.id
      }
    })
  }

  private async sendPagerDuty(config: any, alert: Alert): Promise<void> {
    // PagerDuty implementation
    logger.info('PagerDuty alert would be sent', {
      metadata: {
        serviceKey: config.serviceKey,
        alertId: alert.id
      }
    })
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#dc2626'
      case 'high': return '#ea580c'
      case 'medium': return '#facc15'
      case 'low': return '#22c55e'
      default: return '#6b7280'
    }
  }

  private getSeverityColorDiscord(severity: string): number {
    switch (severity) {
      case 'critical': return 0xdc2626
      case 'high': return 0xea580c
      case 'medium': return 0xfacc15
      case 'low': return 0x22c55e
      default: return 0x6b7280
    }
  }

  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical': return '🚨'
      case 'high': return '⚠️'
      case 'medium': return '⚡'
      case 'low': return 'ℹ️'
      default: return '📊'
    }
  }

  private getDefaultMetrics(): AlertMetrics {
    return {
      heapUsedMB: 0,
      heapTotalMB: 0,
      memoryUsagePercent: 0,
      averageResponseTime: 0,
      activeRequests: 0,
      errorRate: 0,
      errorCount: 0,
      rateLimitViolations: 0,
      authFailures: 0,
      uptime: 0,
      cpuUsage: 0,
      claudeOperationFailures: 0,
      e2bSandboxFailures: 0,
      githubIntegrationFailures: 0,
      deploymentFailures: 0
    }
  }

  private setupDefaultAlertRules(): void {
    // Critical memory usage
    this.addAlertRule({
      id: 'memory-critical',
      name: 'Critical Memory Usage',
      description: 'Memory usage exceeded critical threshold',
      condition: (metrics) => metrics.heapUsedMB > 800,
      severity: 'critical',
      cooldownMs: 5 * 60 * 1000, // 5 minutes
      channels: this.getDefaultChannels(),
      enabled: true
    })

    // High error rate
    this.addAlertRule({
      id: 'error-rate-high',
      name: 'High Error Rate',
      description: 'Error rate exceeded acceptable threshold',
      condition: (metrics) => metrics.errorRate > 5,
      severity: 'high',
      cooldownMs: 10 * 60 * 1000, // 10 minutes
      channels: this.getDefaultChannels(),
      enabled: true
    })

    // Claude operation failures
    this.addAlertRule({
      id: 'claude-failures',
      name: 'Claude Operation Failures',
      description: 'Multiple Claude operations failed',
      condition: (metrics) => metrics.claudeOperationFailures > 10,
      severity: 'high',
      cooldownMs: 15 * 60 * 1000, // 15 minutes
      channels: this.getDefaultChannels(),
      enabled: true
    })

    // E2B sandbox failures
    this.addAlertRule({
      id: 'e2b-failures',
      name: 'E2B Sandbox Failures',
      description: 'Multiple E2B sandbox operations failed',
      condition: (metrics) => metrics.e2bSandboxFailures > 5,
      severity: 'medium',
      cooldownMs: 10 * 60 * 1000, // 10 minutes
      channels: this.getDefaultChannels(),
      enabled: true
    })

    // Rate limit violations
    this.addAlertRule({
      id: 'rate-limit-violations',
      name: 'Rate Limit Violations',
      description: 'High number of rate limit violations detected',
      condition: (metrics) => metrics.rateLimitViolations > 100,
      severity: 'medium',
      cooldownMs: 30 * 60 * 1000, // 30 minutes
      channels: this.getDefaultChannels(),
      enabled: true
    })
  }

  private getDefaultChannels(): AlertChannel[] {
    const channels: AlertChannel[] = []

    // Webhook channel
    if (process.env.ALERT_WEBHOOK_URL) {
      channels.push({
        type: 'webhook',
        config: {
          url: process.env.ALERT_WEBHOOK_URL,
          headers: process.env.ALERT_WEBHOOK_HEADERS ? 
            JSON.parse(process.env.ALERT_WEBHOOK_HEADERS) : {}
        },
        enabled: true
      })
    }

    // Slack channel
    if (process.env.SLACK_WEBHOOK_URL) {
      channels.push({
        type: 'slack',
        config: {
          webhookUrl: process.env.SLACK_WEBHOOK_URL
        },
        enabled: true
      })
    }

    // Discord channel
    if (process.env.DISCORD_WEBHOOK_URL) {
      channels.push({
        type: 'discord',
        config: {
          webhookUrl: process.env.DISCORD_WEBHOOK_URL
        },
        enabled: true
      })
    }

    return channels
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    this.stopMonitoring()
    this.alerts.clear()
    this.lastAlertTime.clear()
    this.alertRules = []
  }
}

// Export singleton instance
export const alertManager = AlertManager.getInstance()

// Cleanup on process exit
process.on('exit', () => {
  alertManager.destroy()
})