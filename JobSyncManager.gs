class JobSyncManager {
  constructor(esiManager, jobManager) {
    this.esiManager = esiManager;
    this.jobManager = jobManager;
    this.alertManager = new AlertManager();
  }
  
  async scanNewESIJobs() {
    const esiJobs = await this.jobManager.pullESIJobs();
    const sheetJobs = this.getSheetJobs();
    return this.findNewJobs(esiJobs, sheetJobs);
  }
  
  getSheetJobs() {
    const sheet = Utility.getSheet(CONFIG.SHEETS.CATEGORIES.BPC_BPO);
    const data = sheet.getDataRange().getValues();
    return data.slice(1).map(row => ({
      blueprint_type_id: row[0],
      runs: row[1],
      duration: row[2],
      installer_id: row[3]
    }));
  }
  
  findNewJobs(esiJobs, sheetJobs) {
    return esiJobs.filter(esiJob => {
      return !sheetJobs.some(sheetJob => 
        sheetJob.blueprint_type_id === esiJob.blueprint_type_id &&
        sheetJob.installer_id === esiJob.installer_id &&
        sheetJob.runs === esiJob.runs
      );
    });
  }
  
  async matchSheetEntries() {
    const newJobs = await this.scanNewESIJobs();
    for (const job of newJobs) {
      if (!this.validateJobOwnership(job)) {
        await this.alertManager.sendUnauthorizedJobAlert(job);
      }
    }
    return newJobs;
  }
  
  validateJobOwnership(job) {
    const sheet = Utility.getSheet('Contributors');
    const data = sheet.getDataRange().getValues();
    const contributors = data.slice(1).map(row => row[0]);
    return contributors.includes(job.installer_id);
  }
  
  async reconcileMaterials(jobs) {
    const materialTracker = new MaterialTracker(this.esiManager);
    const impacts = [];
    
    for (const job of jobs) {
      const materialImpact = await materialTracker.calculateUsage(
        await this.getJobMaterials(job)
      );
      impacts.push({
        job,
        impact: materialImpact
      });
    }
    
    return impacts;
  }
  
  async getJobMaterials(job) {
    const typeInfo = await this.esiManager.fetchESIData(
      `/universe/types/${job.blueprint_type_id}/`
    );
    return typeInfo.materials || {};
  }
  
  async updateProjectStatus() {
    const sheet = Utility.getSheet(CONFIG.SHEETS.CATEGORIES.DASHBOARD);
    const jobs = await this.jobManager.pullESIJobs();
    
    const status = this.calculateProjectStatus(jobs);
    this.updateStatusSheet(sheet, status);
  }
  
  calculateProjectStatus(jobs) {
    const total = jobs.length;
    const completed = jobs.filter(job => job.status === 'delivered').length;
    const inProgress = jobs.filter(job => job.status === 'active').length;
    
    return {
      total,
      completed,
      inProgress,
      percentComplete: total > 0 ? (completed / total) * 100 : 0
    };
  }
  
  updateStatusSheet(sheet, status) {
    const statusRange = sheet.getRange('B2:B5');
    statusRange.setValues([
      [status.total],
      [status.completed],
      [status.inProgress],
      [status.percentComplete]
    ]);
  }
} 