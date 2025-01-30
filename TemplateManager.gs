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
    this.setupFormulas(sheet);
    this.setupProtections(sheet);
    this.setupDataValidation(sheet);
    this.setupConditionalFormatting(sheet);
    this.setupNamedRanges(sheet);
    
    return sheet;
  }
  
  setupFormulas(sheet) {
    const updates = [];
    
    // Dashboard formulas
    updates.push({
      range: this.namedRanges.DASHBOARD_STATS,
      values: [
        ['=COUNTA(INDIRECT("' + this.ranges.BPC_BPO + '"))'],
        ['=COUNTIF(INDIRECT("' + this.ranges.BPC_BPO + '"), "Completed")'],
        ['=COUNTIF(INDIRECT("' + this.ranges.BPC_BPO + '"), "In Progress")'],
        ['=(B3/B2)*100']
      ]
    });
    
    // Material calculations
    const materialsRange = Utility.getRange(sheet, 'MATERIALS');
    const lastRow = materialsRange.getLastRow();
    const firstRow = materialsRange.getRow();
    
    // Total value formula
    updates.push({
      range: `D${firstRow}:D${lastRow}`,
      values: Array(lastRow - firstRow + 1).fill(['=IF(B{row}="","",B{row}*C{row})'])
    });
    
    // Required vs Available
    updates.push({
      range: `E${firstRow}:E${lastRow}`,
      values: Array(lastRow - firstRow + 1).fill(['=IF(AND(B{row}<>"",C{row}<>""),B{row}-C{row},"")'])
    });
    
    Utility.batchUpdate(sheet, updates);
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
    
    if (errors.length > 0) {
      throw new Error(`Template validation failed:\n${errors.join('\n')}`);
    }
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
  
  setupDataValidation(sheet) {
    const validations = [];
    
    // Job type validation
    validations.push({
      range: Utility.getNamedRange(sheet, 'JOB_TYPES'),
      rule: SpreadsheetApp.newDataValidation()
        .requireValueInList(['BPC', 'BPO', 'Reaction', 'Component', 'Final'])
        .setAllowInvalid(false)
        .build()
    });
    
    // Status validation
    validations.push({
      range: Utility.getNamedRange(sheet, 'JOB_STATUS'),
      rule: SpreadsheetApp.newDataValidation()
        .requireValueInList(['Not Started', 'In Progress', 'Completed', 'Failed'])
        .setAllowInvalid(false)
        .build()
    });
    
    // Apply all validations at once
    validations.forEach(validation => {
      validation.range.setDataValidation(validation.rule);
    });
  }
  
  setupConditionalFormatting(sheet) {
    const statusRange = Utility.getNamedRange(sheet, 'JOB_STATUS');
    
    // Create all rules at once
    const rules = [
      {
        when: 'Completed',
        color: '#b7e1cd'
      },
      {
        when: 'In Progress',
        color: '#fce8b2'
      },
      {
        when: 'Failed',
        color: '#f4c7c3'
      }
    ].map(rule => 
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(rule.when)
        .setBackground(rule.color)
        .setRanges([statusRange])
        .build()
    );
    
    sheet.setConditionalFormatRules(rules);
  }
  
  setupNamedRanges(sheet) {
    const ss = sheet.getParent();
    const namedRanges = [];
    
    // Prepare all named ranges
    for (const [name, range] of Object.entries(this.ranges)) {
      namedRanges.push({
        name: `${sheet.getName()}_${name}`,
        range: sheet.getRange(range)
      });
    }
    
    // Set all named ranges at once
    namedRanges.forEach(nr => {
      ss.setNamedRange(nr.name, nr.range);
    });
  }
} 