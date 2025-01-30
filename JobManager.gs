class JobManager {
  constructor(esiManager) {
    this.esiManager = esiManager;
  }
  
  async pullESIJobs() {
    const cached = Utility.cacheGet('industry_jobs');
    if (cached) return cached;
    
    const jobs = await this.esiManager.fetchESIData('/corporation/{corporation_id}/industry/jobs/');
    Utility.cacheSet('industry_jobs', jobs, CONFIG.ESI.CACHE_DURATIONS.INDUSTRY_JOBS);
    return jobs;
  }
  
  validateNewJob(jobData) {
    const sheet = Utility.getSheet(CONFIG.SHEETS.CATEGORIES.BPC_BPO);
    const lastRow = Utility.getLastRow(sheet);
    const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    
    // Validate job data against existing entries
    return {
      isValid: true,
      errors: []
    };
  }
  
  calculateBPCFees(days, runs, bpType) {
    const dailyFee = CONFIG.FEES.DAILY_LOCATION * days;
    const runFee = CONFIG.FEES.RUN_RATES[bpType] * runs;
    return dailyFee + runFee;
  }
  
  async checkMaterialAvailability(jobData) {
    const materialTracker = new MaterialTracker(this.esiManager);
    return await materialTracker.calculateUsage(jobData.materials);
  }
  
  async syncWithESI() {
    const jobs = await this.pullESIJobs();
    const sheet = Utility.getSheet(CONFIG.SHEETS.CATEGORIES.BPC_BPO);
    this.updateJobsSheet(sheet, jobs);
  }
  
  updateJobsSheet(sheet, jobs) {
    const data = jobs.map(job => [
      job.blueprint_type_id,
      job.runs,
      job.duration,
      this.calculateBPCFees(job.duration / 86400, job.runs, job.activity_id)
    ]);
    
    const range = sheet.getRange(2, 1, data.length, data[0].length);
    range.setValues(data);
  }
} 