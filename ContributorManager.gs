class ContributorManager {
  constructor(rewardCalculator) {
    this.rewardCalculator = rewardCalculator;
    this.activityLog = [];
  }
  
  validateContribution(contributorId, materialData) {
    const sheet = Utility.getSheet(CONFIG.SHEETS.CATEGORIES.MATERIALS);
    const data = sheet.getDataRange().getValues();
    
    // Validate material data against sheet
    const errors = [];
    for (const [typeId, quantity] of Object.entries(materialData)) {
      const materialRow = data.find(row => row[0] === parseInt(typeId));
      if (!materialRow) {
        errors.push(`Invalid material type: ${typeId}`);
      } else if (quantity <= 0) {
        errors.push(`Invalid quantity for material ${typeId}: ${quantity}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  async trackMaterialDeposit(contributorId, materials) {
    const timestamp = new Date();
    const deposit = {
      contributorId,
      materials,
      timestamp,
      value: await this.rewardCalculator.materialValue(materials)
    };
    
    this.logActivity({
      type: 'DEPOSIT',
      ...deposit
    });
    
    return deposit;
  }
  
  calculateRewards(projectData) {
    return this.rewardCalculator.calculateProjectRewards(projectData);
  }
  
  distributeProfit(profit, contributions) {
    return this.rewardCalculator.profitSplit(profit, contributions);
  }
  
  logActivity(activity) {
    this.activityLog.push({
      ...activity,
      timestamp: new Date()
    });
    this.updateActivitySheet(activity);
  }
  
  updateActivitySheet(activity) {
    const sheet = Utility.getSheet('Activity Log');
    sheet.appendRow([
      activity.timestamp,
      activity.type,
      activity.contributorId,
      JSON.stringify(activity)
    ]);
  }
  
  getContributorStats(contributorId) {
    const activities = this.activityLog.filter(
      activity => activity.contributorId === contributorId
    );
    
    return {
      totalDeposits: activities
        .filter(a => a.type === 'DEPOSIT')
        .reduce((sum, a) => sum + a.value, 0),
      totalJobs: activities
        .filter(a => a.type === 'JOB')
        .length,
      lastActivity: activities.length > 0 
        ? activities[activities.length - 1].timestamp 
        : null
    };
  }
  
  updateContributorSheet() {
    const sheet = Utility.getSheet('Contributors');
    const contributors = new Set(
      this.activityLog.map(activity => activity.contributorId)
    );
    
    const data = Array.from(contributors).map(contributorId => {
      const stats = this.getContributorStats(contributorId);
      return [
        contributorId,
        stats.totalDeposits,
        stats.totalJobs,
        stats.lastActivity
      ];
    });
    
    // Clear existing data
    const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4);
    range.clearContent();
    
    // Update with new data
    if (data.length > 0) {
      sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
    }
  }
} 