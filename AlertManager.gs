class AlertManager {
  constructor() {
    this.alerts = [];
  }
  
  async sendUnauthorizedJobAlert(job) {
    const alert = {
      type: 'UNAUTHORIZED_JOB',
      job,
      timestamp: new Date()
    };
    
    this.alerts.push(alert);
    await this.notifyProjectManager(alert);
  }
  
  async notifyMaterialConflict(conflict) {
    const alert = {
      type: 'MATERIAL_CONFLICT',
      conflict,
      timestamp: new Date()
    };
    
    this.alerts.push(alert);
    await this.notifyProjectManager(alert);
  }
  
  async notifyResourceDepletion(resource) {
    const alert = {
      type: 'RESOURCE_DEPLETION',
      resource,
      timestamp: new Date()
    };
    
    this.alerts.push(alert);
    await this.notifyProjectManager(alert);
  }
  
  async notifyProjectManager(alert) {
    const sheet = Utility.getSheet('Alerts');
    sheet.appendRow([
      alert.timestamp,
      alert.type,
      JSON.stringify(alert)
    ]);
    
    // Send email notification if configured
    if (CONFIG.NOTIFICATIONS?.EMAIL_ENABLED) {
      await this.sendEmailNotification(alert);
    }
  }
  
  async sendEmailNotification(alert) {
    const recipient = CONFIG.NOTIFICATIONS?.PROJECT_MANAGER_EMAIL;
    if (!recipient) return;
    
    const subject = `[Industry Manager] ${alert.type} Alert`;
    const body = this.formatAlertEmail(alert);
    
    MailApp.sendEmail({
      to: recipient,
      subject: subject,
      body: body
    });
  }
  
  formatAlertEmail(alert) {
    let body = `Alert Type: ${alert.type}\n`;
    body += `Timestamp: ${alert.timestamp}\n\n`;
    
    switch (alert.type) {
      case 'UNAUTHORIZED_JOB':
        body += `Unauthorized job detected:\n`;
        body += `Blueprint: ${alert.job.blueprint_type_id}\n`;
        body += `Installer: ${alert.job.installer_id}\n`;
        body += `Runs: ${alert.job.runs}\n`;
        break;
        
      case 'MATERIAL_CONFLICT':
        body += `Material conflict detected:\n`;
        body += `Material: ${alert.conflict.material_id}\n`;
        body += `Required: ${alert.conflict.required}\n`;
        body += `Available: ${alert.conflict.available}\n`;
        break;
        
      case 'RESOURCE_DEPLETION':
        body += `Resource depletion warning:\n`;
        body += `Resource: ${alert.resource.type_id}\n`;
        body += `Current Level: ${alert.resource.current}\n`;
        body += `Threshold: ${alert.resource.threshold}\n`;
        break;
    }
    
    return body;
  }
  
  getRecentAlerts(hours = 24) {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);
    
    return this.alerts.filter(alert => alert.timestamp > cutoff);
  }
  
  clearOldAlerts(days = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    this.alerts = this.alerts.filter(alert => alert.timestamp > cutoff);
    
    // Also clean up the alerts sheet
    const sheet = Utility.getSheet('Alerts');
    const data = sheet.getDataRange().getValues();
    const rowsToKeep = data.filter(row => row[0] > cutoff);
    
    sheet.clearContents();
    if (rowsToKeep.length > 0) {
      sheet.getRange(1, 1, rowsToKeep.length, rowsToKeep[0].length)
        .setValues(rowsToKeep);
    }
  }
} 