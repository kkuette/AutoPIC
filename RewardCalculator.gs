class RewardCalculator {
  constructor(marketManager) {
    this.marketManager = marketManager;
  }
  
  async materialValue(materials) {
    return await this.marketManager.calculateTotalValue(materials);
  }
  
  jobCostShare(jobData) {
    const { runs, bpType, days } = jobData;
    return this.calculateBPCFees(days, runs, bpType);
  }
  
  timeInvestment(contributorActivities) {
    return contributorActivities.reduce((total, activity) => {
      return total + this.calculateActivityValue(activity);
    }, 0);
  }
  
  calculateActivityValue(activity) {
    const baseValues = {
      MATERIAL_DEPOSIT: 1000000,
      JOB_START: 500000,
      JOB_COMPLETION: 1000000,
      RESEARCH: 2000000
    };
    
    return baseValues[activity.type] || 0;
  }
  
  profitSplit(totalProfit, contributions) {
    const totalContribution = Object.values(contributions).reduce((a, b) => a + b, 0);
    const shares = {};
    
    for (const [contributorId, contribution] of Object.entries(contributions)) {
      shares[contributorId] = (contribution / totalContribution) * totalProfit;
    }
    
    return shares;
  }
  
  calculateBPCFees(days, runs, bpType) {
    const dailyRate = CONFIG.FEES.DAILY_LOCATION;
    const runRate = CONFIG.FEES.RUN_RATES[bpType] || 0;
    
    return (dailyRate * days) + (runRate * runs);
  }
  
  calculateProjectRewards(projectData) {
    const { materials, jobs, activities } = projectData;
    const rewards = {};
    
    // Calculate material contributions
    for (const [contributorId, materialList] of Object.entries(materials)) {
      rewards[contributorId] = rewards[contributorId] || 0;
      rewards[contributorId] += this.materialValue(materialList);
    }
    
    // Calculate job contributions
    for (const [contributorId, jobList] of Object.entries(jobs)) {
      rewards[contributorId] = rewards[contributorId] || 0;
      jobList.forEach(job => {
        rewards[contributorId] += this.jobCostShare(job);
      });
    }
    
    // Calculate time investment
    for (const [contributorId, activityList] of Object.entries(activities)) {
      rewards[contributorId] = rewards[contributorId] || 0;
      rewards[contributorId] += this.timeInvestment(activityList);
    }
    
    return rewards;
  }
  
  updateRewardSheet(rewards) {
    const sheet = Utility.getSheet('Rewards');
    const data = Object.entries(rewards).map(([contributorId, value]) => [
      contributorId,
      value,
      new Date()
    ]);
    
    // Clear existing data
    const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3);
    range.clearContent();
    
    // Update with new data
    if (data.length > 0) {
      sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
    }
  }
} 