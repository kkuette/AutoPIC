var RANGE_CACHE = {};

class Utility {
  constructor() {
    if (!Utility.rangeCache) {
      Utility.rangeCache = new Map();
    }
  }
  
  static formatISK(amount) {
    return amount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
  }
  
  static getRange(sheet, rangeName) {
    const cacheKey = `${sheet.getName()}_${rangeName}`;
    if (!RANGE_CACHE[cacheKey]) {
      RANGE_CACHE[cacheKey] = sheet.getRange(CONFIG.RANGES[rangeName]);
    }
    return RANGE_CACHE[cacheKey];
  }
  
  static getNamedRange(sheet, rangeName) {
    const cacheKey = `${sheet.getName()}_named_${rangeName}`;
    if (!RANGE_CACHE[cacheKey]) {
      RANGE_CACHE[cacheKey] = sheet.getRange(CONFIG.NAMED_RANGES[rangeName]);
    }
    return RANGE_CACHE[cacheKey];
  }
  
  static getRangeData(sheet, rangeName) {
    const cacheKey = `${sheet.getName()}_${rangeName}_data`;
    if (!RANGE_CACHE[cacheKey]) {
      const range = this.getRange(sheet, rangeName);
      RANGE_CACHE[cacheKey] = range.getValues();
    }
    return RANGE_CACHE[cacheKey];
  }
  
  static getLastRowInRange(sheet, rangeName) {
    const values = this.getRangeData(sheet, rangeName);
    const range = this.getRange(sheet, rangeName);
    for (let i = values.length - 1; i >= 0; i--) {
      if (values[i].some(cell => cell !== '')) {
        return range.getRow() + i;
      }
    }
    return range.getRow();
  }
  
  static getLastColumnInRange(sheet, rangeName) {
    const values = this.getRangeData(sheet, rangeName);
    const range = this.getRange(sheet, rangeName);
    let maxCol = 0;
    values.forEach(row => {
      for (let i = row.length - 1; i >= 0; i--) {
        if (row[i] !== '') {
          maxCol = Math.max(maxCol, i + 1);
          break;
        }
      }
    });
    return range.getColumn() + maxCol - 1;
  }
  
  static clearCache() {
    RANGE_CACHE = {};
    CacheService.getScriptCache().removeAll([]);
  }
  
  static cacheGet(key) {
    const cache = CacheService.getScriptCache();
    const data = cache.get(key);
    return data ? JSON.parse(data) : null;
  }
  
  static cacheSet(key, value, duration) {
    const cache = CacheService.getScriptCache();
    cache.put(key, JSON.stringify(value), duration);
  }
  
  static getActiveProject() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();
    if (!sheet.getName().startsWith('Project_')) {
      throw new Error('Not a project sheet');
    }
    return sheet;
  }
  
  static batchUpdate(sheet, updates) {
    updates.forEach(update => {
      if (typeof update.range === 'string') {
        sheet.getRange(update.range).setValues(update.values);
      } else {
        update.range.setValues(update.values);
      }
    });
  }
  
  static batchGetRangeData(sheet, rangeNames) {
    const rangeAddresses = rangeNames.map(name => CONFIG.RANGES[name]);
    const rangeList = sheet.getRangeList(rangeAddresses);
    const ranges = rangeList.getRanges();
    
    const result = {};
    rangeNames.forEach((name, index) => {
      const values = ranges[index].getValues();
      const cacheKey = `${sheet.getName()}_${name}_data`;
      RANGE_CACHE[cacheKey] = values;
      result[name] = values;
    });
    
    return result;
  }
  
  static invalidateRangeCache(sheet, rangeName) {
    const cacheKeys = [
      `${sheet.getName()}_${rangeName}`,
      `${sheet.getName()}_${rangeName}_data`,
      `${sheet.getName()}_named_${rangeName}`
    ];
    
    cacheKeys.forEach(key => delete RANGE_CACHE[key]);
  }
} 