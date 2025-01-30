class TemplateManager {
  constructor() {
    this.ranges = CONFIG.RANGES;
    this.namedRanges = CONFIG.NAMED_RANGES;
  }
  
  createNewProject(projectName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const template = ss.getSheetByName('Template');
    
    if (!template) {
      throw new Error('Template sheet not found');
    }
    
    const newSheet = template.copyTo(ss);
    newSheet.setName(projectName);
    newSheet.activate();
    
    return this.initializeProject(newSheet);
  }
  
  initializeProject(sheet) {
    // Load all range data at once
    const rangeData = Utility.batchGetRangeData(sheet, Object.keys(this.ranges));
    
    this.validateStructure(sheet, rangeData);
    this.setupProtections(sheet);

    
    return sheet;
  }
  
  validateStructure(sheet, rangeData) {
    const errors = [];
    
    // Check all required ranges exist
    for (const [name, range] of Object.entries(this.ranges)) {
      if (!rangeData[name]) {
        errors.push(`Missing required range: ${name}`);
      }
    }
    
    // Check required columns in materials section
    const materialsData = rangeData['MATERIALS'];
    if (materialsData && materialsData.length > 0) {
      const headers = materialsData[0];
      const requiredColumns = [
        'Name',
        'To Buy',
        'To Buy (Sell-Value)', 
        'Restant',
      ];
      requiredColumns.forEach(column => {
        if (!headers.includes(column)) {
          errors.push(`Missing required column in Materials: ${column}`);
        }
      });
    }

    // Check required columns in BPC/BPO section
    const bpcBpoData = rangeData['BPC_BPO'];
    if (bpcBpoData && bpcBpoData.length > 0) {
      const headers = bpcBpoData[0];
      const requiredColumns = [
        'BPC',
        'Run ou cycle par exemplaire',
        'Qui?',
        'Type',
        'Remunération'
      ];
      requiredColumns.forEach(column => {
        if (!headers.includes(column)) {
          errors.push(`Missing required column in BPC/BPO: ${column}`);
        }
      });
    }

    // Check required columns in Reactions section
    const reactionsData = rangeData['REACTIONS'];
    if (reactionsData && reactionsData.length > 0) {
      const headers = reactionsData[0];
      const requiredColumns = [
        'Name',
        'Runs', 
        'Days',
        'Job Cost',
        'Qui ?',
        'Payé Corpo?'
      ];
      requiredColumns.forEach(column => {
        if (!headers.includes(column)) {
          errors.push(`Missing required column in Reactions: ${column}`);
        }
      });
    }

    // Check required columns in Components section
    const componentsData = rangeData['COMPONENTS'];
    if (componentsData && componentsData.length > 0) {
      const headers = componentsData[0];
      const requiredColumns = [
        'Name',
        'Runs',
        'Days', 
        'Job Cost',
        'Qui ?',
        'Payé Corpo?'
      ];
      requiredColumns.forEach(column => {
        if (!headers.includes(column)) {
          errors.push(`Missing required column in Components: ${column}`);
        }
      });
    }

    // Check required columns in Products section
    const productsData = rangeData['PRODUCTS'];
    if (productsData && productsData.length > 0) {
      const headers = productsData[0];
      const requiredColumns = [
        'Name',
        'Runs',
        'Days',
        'Job Cost',
        'Qui ?',
        'Payé Corpo?'
      ];
      requiredColumns.forEach(column => {
        if (!headers.includes(column)) {
          errors.push(`Missing required column in Products: ${column}`);
        }
      });
    }
    
    if (errors.length > 0) {
      throw new Error(`Template validation failed:\n${errors.join('\n')}`);
    }
    console.log('Template validation passed');
  }
  
  setupProtections(sheet) {
    // Get the current user as editor
    const me = Session.getEffectiveUser();
    
    // Protect dashboard stats
    const dashboardStats = Utility.getNamedRange(sheet, 'DASHBOARD_STATS');
    const protection = dashboardStats.protect();
    protection.setDescription('Protected Formulas - Dashboard Stats');
    
    // Remove all other editors to avoid the "too many editors" error
    protection.removeEditors(protection.getEditors());
    protection.addEditor(me);
    
    // Unprotect the sheet itself to allow editing of non-protected ranges
    const sheetProtection = sheet.protect();
    sheetProtection.remove();
  }
}