class MarketManager {
  constructor(esiManager) {
    this.esiManager = esiManager;
  }
  
  async getMarketPrices() {
    const cached = Utility.cacheGet('market_prices');
    if (cached) return cached;
    
    const prices = await this.esiManager.fetchESIData('/markets/prices/');
    Utility.cacheSet('market_prices', prices, CONFIG.ESI.CACHE_DURATIONS.MARKET_PRICES);
    return prices;
  }
  
  async updateCosts() {
    const prices = await this.getMarketPrices();
    const sheet = Utility.getSheet(CONFIG.SHEETS.CATEGORIES.MATERIALS);
    this.updatePriceColumn(sheet, prices);
  }
  
  updatePriceColumn(sheet, prices) {
    const data = sheet.getDataRange().getValues();
    const priceMap = new Map(prices.map(p => [p.type_id, p.adjusted_price]));
    
    for (let i = 1; i < data.length; i++) {
      const typeId = data[i][0];
      if (priceMap.has(typeId)) {
        sheet.getRange(i + 1, 3).setValue(priceMap.get(typeId));
      }
    }
  }
  
  async calculateTotalValue(materials) {
    const prices = await this.getMarketPrices();
    let total = 0;
    
    for (const [typeId, quantity] of Object.entries(materials)) {
      const price = prices.find(p => p.type_id === parseInt(typeId));
      if (price) {
        total += price.adjusted_price * quantity;
      }
    }
    
    return total;
  }
  
  async updateMaterialValues() {
    const sheet = Utility.getSheet(CONFIG.SHEETS.CATEGORIES.MATERIALS);
    const data = sheet.getDataRange().getValues();
    const prices = await this.getMarketPrices();
    
    for (let i = 1; i < data.length; i++) {
      const typeId = data[i][0];
      const quantity = data[i][1];
      const price = prices.find(p => p.type_id === typeId);
      
      if (price) {
        const totalValue = price.adjusted_price * quantity;
        sheet.getRange(i + 1, 4).setValue(totalValue);
      }
    }
  }
} 