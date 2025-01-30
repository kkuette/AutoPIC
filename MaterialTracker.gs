class MaterialTracker {
  constructor(esiManager) {
    this.esiManager = esiManager;
    this.assetCache = {};
  }
  
  async fetchESIAssets() {
    const cached = Utility.cacheGet('corporation_assets');
    if (cached) return cached;
    
    const assets = await this.esiManager.fetchESIData('/corporation/{corporation_id}/assets/');
    Utility.cacheSet('corporation_assets', assets, CONFIG.ESI.CACHE_DURATIONS.ASSETS);
    return assets;
  }
  
  async matchContainers(containerIds) {
    const assets = await this.fetchESIAssets();
    return assets.filter(asset => containerIds.includes(asset.location_id));
  }
  
  calculateUsage(materialList, jobRequirements) {
    const usage = {};
    for (const [materialId, amount] of Object.entries(jobRequirements)) {
      if (!usage[materialId]) {
        usage[materialId] = {
          required: 0,
          available: materialList[materialId] || 0
        };
      }
      usage[materialId].required += amount;
    }
    return usage;
  }
  
  async syncInventory() {
    const sheet = Utility.getSheet(CONFIG.SHEETS.CATEGORIES.MATERIALS);
    const assets = await this.fetchESIAssets();
    this.updateMaterialSheet(sheet, assets);
  }
  
  updateMaterialSheet(sheet, assets) {
    const data = this.processAssetData(assets);
    const range = sheet.getRange(2, 1, data.length, data[0].length);
    range.setValues(data);
  }
  
  processAssetData(assets) {
    return assets.map(asset => [
      asset.type_id,
      asset.quantity,
      0, // Market value will be updated by MarketManager
      asset.location_id,
      asset.is_singleton ? 'Yes' : 'No'
    ]);
  }
} 