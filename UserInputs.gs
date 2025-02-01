/// <reference types="google-apps-script" />

/**
 * Base class for data processing
 */
class DataProcessor {
  constructor(sheet) {
    this.sheet = sheet;
  }

  /**
   * Validates and prepares the sheet for data processing
   * @protected
   */
  validateSheet() {
    if (!this.sheet) {
      Logger.log('[DataProcessor] Error: No active sheet found');
      throw new Error('No active sheet found');
    }
    
    if (this.sheet.getName() === 'Template') {
      Logger.log('[DataProcessor] Error: Cannot modify Template tab');
      throw new Error('Cannot modify Template tab. Please switch to a different tab before importing.');
    }
  }

  /**
   * Checks for existing data and handles overwrite confirmation
   * @protected
   * @param {GoogleAppsScript.Spreadsheet.Range} range - Range to check
   * @param {boolean} forceOverwrite - Whether to skip confirmation
   * @returns {boolean} Whether there is existing data
   */
  checkExistingData(range, forceOverwrite) {
    const existingData = range.getValues();
    const hasExistingData = existingData.some(row => row.some(cell => cell !== ''));
    
    if (hasExistingData && !forceOverwrite) {
      const ui = SpreadsheetApp.getUi();
      const response = ui.alert(
        'Existing Data Found',
        'There is existing data in this section. Do you want to overwrite it?',
        ui.ButtonSet.YES_NO
      );
      
      if (response !== ui.Button.YES) {
        Logger.log('[DataProcessor] User cancelled operation');
        throw new Error('Operation cancelled by user');
      }
    }
    
    return hasExistingData;
  }

  /**
   * Copies formatting and data validation from template row to target range
   * @protected
   * @param {number} templateRow - Row number of template
   * @param {number} startRow - Start row for target range
   * @param {number} endRow - End row for target range
   */
  copyFormatting(templateRow, startRow, endRow) {
    const templateRange = this.sheet.getRange(templateRow, 1, 1, this.sheet.getLastColumn());
    const numRows = endRow - startRow + 1;
    
    // Copy formatting
    templateRange.copyFormatToRange(this.sheet, 1, this.sheet.getLastColumn(), startRow, endRow);
    
    // Get template validations
    const templateValidations = templateRange.getDataValidations()[0];
    
    // Get existing validations for the entire range
    const targetRange = this.sheet.getRange(startRow, 1, numRows, this.sheet.getLastColumn());
    const existingValidations = targetRange.getDataValidations();
    
    // Create new validation rules array, preserving existing ones
    const newValidations = existingValidations.map(row => 
      row.map((validation, colIndex) => 
        validation || templateValidations[colIndex]
      )
    );
    
    // Apply validations in batch
    targetRange.setDataValidations(newValidations);
  }

  /**
   * Adjusts formulas for new row positions
   * @protected
   * @param {string} formula - Original formula
   * @param {number} templateRow - Source row number
   * @param {number} targetRow - Target row number
   * @returns {string} Adjusted formula
   */
  adjustFormula(formula, templateRow, targetRow) {
    let adjustedFormula = formula;
    const cellRefs = formula.match(/(\$?[A-Z]+)(\$?\d+)/g) || [];
    
    for (const ref of cellRefs) {
      if (ref.includes('$')) continue;  // Skip absolute references
      const colRef = ref.match(/[A-Z]+/)[0];
      const rowRef = parseInt(ref.match(/\d+/)[0]);
      const rowDiff = rowRef - templateRow;
      const newRowNum = targetRow + rowDiff;
      adjustedFormula = adjustedFormula.replace(
        new RegExp(`${colRef}${rowRef}(?![0-9])`, 'g'),
        `${colRef}${newRowNum}`
      );
    }
    
    return adjustedFormula;
  }

  /**
   * Clears data while preserving headers
   * @protected
   * @param {GoogleAppsScript.Spreadsheet.Range} range - Range to clear
   */
  clearDataPreservingHeader(range) {
    const startRow = range.getRow() + 1;  // +1 to skip header
    const startColumn = range.getColumn();
    const numRows = range.getHeight() - 1;  // -1 to account for header
    const numColumns = range.getWidth();

    if (numRows > 0) {
      const dataRange = this.sheet.getRange(startRow, startColumn, numRows, numColumns);
      dataRange.clearContent();
    }
  }

  /**
   * Gets formulas from a range, preserving empty cells as null
   * @protected
   * @param {GoogleAppsScript.Spreadsheet.Range} range - Range to get formulas from
   * @returns {Array<Array<string|null>>} Array of formulas
   */
  getFormulas(range) {
    return range.getFormulas().map(row => 
      row.map(cell => cell || null)
    );
  }

  /**
   * Extends formulas to new rows based on a template row
   * @protected
   * @param {number} templateRow - Row to use as template
   * @param {number} startRow - Start row for new formulas
   * @param {number} endRow - End row for new formulas
   */
  extendFormulas(templateRow, startRow, endRow) {
    const templateRange = this.sheet.getRange(templateRow, 1, 1, this.sheet.getLastColumn());
    const templateFormulas = this.getFormulas(templateRange)[0];
    
    if (!templateFormulas.some(f => f !== null)) return; // No formulas to extend
    
    const newFormulas = [];
    for (let row = startRow; row <= endRow; row++) {
      newFormulas.push(
        templateFormulas.map(formula => 
          formula ? this.adjustFormula(formula, templateRow, row) : null
        )
      );
    }
    
    if (newFormulas.length > 0) {
      const targetRange = this.sheet.getRange(startRow, 1, newFormulas.length, templateFormulas.length);
      targetRange.setFormulas(newFormulas);
    }
  }
}

/**
 * Class for handling material data processing
 */
class MaterialProcessor extends DataProcessor {
  constructor(sheet) {
    super(sheet);
    this.range = sheet.getRange(CONFIG.RANGES.MATERIALS);
  }

  /**
   * Process material data
   * @param {string} inputData - Tab-separated material data
   * @param {boolean} forceOverwrite - Whether to skip overwrite confirmation
   * @returns {ProcessingResult} Processing result
   */
  process(inputData, forceOverwrite = false) {
    Logger.log('[MaterialProcessor] Starting material data processing...');
    
    if (!inputData) {
      throw new Error('No data provided');
    }

    this.validateSheet();
    const hasExistingData = this.checkExistingData(this.range, forceOverwrite);
    
    const processedData = this.parseInputData(inputData);
    if (processedData.length === 0) {
      throw new Error('No valid data rows found');
    }

    return this.writeData(processedData, hasExistingData);
  }

  /**
   * Parse input data into rows
   * @private
   * @param {string} inputData - Tab-separated data
   * @returns {Array<Array<any>>} Processed data rows
   */
  parseInputData(inputData) {
    const rows = inputData.split('\n');
    const processedData = [];
    let skippedRows = 0;
    
    // Skip header row and process data
    for (let i = 1; i < rows.length; i++) {
      const columns = rows[i].split('\t');
      
      if (columns.length >= 3) {
        const toBuy = parseFloat(columns[1]) || 0;
        
        if (toBuy > 0) {
          processedData.push([
            columns[0],
            toBuy,
            parseFloat(columns[2]) || 0
          ]);
        } else {
          skippedRows++;
        }
      } else {
        skippedRows++;
      }
    }
    
    return processedData;
  }

  /**
   * Write processed data to sheet
   * @private
   * @param {Array<Array<any>>} processedData - Data to write
   * @param {boolean} hasExistingData - Whether there was existing data
   * @returns {ProcessingResult} Processing result
   */
  writeData(processedData, hasExistingData) {
    const startRow = this.range.getRow() + 1; // Skip header
    const startColumn = this.range.getColumn();
    const templateRow = startRow;
    const totalColumns = this.range.getLastColumn() - this.range.getColumn() + 1; // Use full range width
    
    // Get template formatting
    const templateRange = this.sheet.getRange(templateRow, startColumn, 1, totalColumns);

    // get data columns
    const dataColumns = processedData[0]?.length || 0;
    
    // Clear data while preserving header
    if (hasExistingData) {
      const clearRange = this.sheet.getRange(startRow, startColumn, this.range.getHeight() - 1, dataColumns);
      clearRange.clearContent();
    }

    // Copy template formatting for all columns
    templateRange.copyTo(
      this.sheet.getRange(
        startRow,
        startColumn,
        processedData.length,
        totalColumns
      )
    );

    // Write the new data (only first 3 columns)
    const writeRange = this.sheet.getRange(startRow, startColumn, processedData.length, 3);
    writeRange.setValues(processedData);

    // Apply number formatting for the first 3 columns
    const formats = {
      toBuy: '#,##0',
      toBuyValue: '#,##0.00'
    };

    Object.entries(formats).forEach(([_, format], index) => {
      this.sheet.getRange(startRow, startColumn + index + 1, processedData.length, 1)
        .setNumberFormat(format);
    });
      
    return {
      success: true,
      rowsProcessed: processedData.length,
      details: {
        writeRange: writeRange.getA1Notation()
      }
    };
  }
}

/**
 * Class for handling job data processing
 */
class JobProcessor extends DataProcessor {
  constructor(sheet, jobType) {
    super(sheet);
    this.jobType = jobType;
    Logger.log(`[JobProcessor] Initializing for ${jobType}`);
    
    if (!CONFIG.RANGES[jobType]) {
      Logger.log(`[JobProcessor] Error: Invalid range for job type ${jobType}`);
      throw new Error(`Invalid job type: ${jobType}`);
    }
    
    try {
      this.range = sheet.getRange(CONFIG.RANGES[jobType]);
      Logger.log(`[JobProcessor] Range set to ${CONFIG.RANGES[jobType]}`);
    } catch (error) {
      Logger.log(`[JobProcessor] Error getting range: ${error}`);
      throw error;
    }
  }

  /**
   * Adjusts color for different subcategories
   * @private
   * @param {string} color - Base color in hex format
   * @param {number} factor - Adjustment factor
   * @returns {string} Adjusted color in hex format
   */
  adjustColor(color, factor) {
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Convert RGB to HSL
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    const l = (max + min) / 2;
    
    let h, s;
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      if (max === r/255) h = (g/255 - b/255) / d + (g < b ? 6 : 0);
      else if (max === g/255) h = (b/255 - r/255) / d + 2;
      else h = (r/255 - g/255) / d + 4;
      
      h *= 60;
    }
    
    // Adjust hue, saturation, and lightness
    h = (h + 15 * factor) % 360;  // Smaller hue shift
    s = Math.min(1, s * (1 + 0.2 * factor));  // Smaller saturation increase
    const newL = Math.max(0.2, l * (1 - 0.15 * factor));  // Reduce lightness for darker colors
    
    // Convert back to RGB
    const c = (1 - Math.abs(2 * newL - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = newL - c/2;
    
    let rp, gp, bp;
    if (h < 60) { [rp, gp, bp] = [c, x, 0]; }
    else if (h < 120) { [rp, gp, bp] = [x, c, 0]; }
    else if (h < 180) { [rp, gp, bp] = [0, c, x]; }
    else if (h < 240) { [rp, gp, bp] = [0, x, c]; }
    else if (h < 300) { [rp, gp, bp] = [x, 0, c]; }
    else { [rp, gp, bp] = [c, 0, x]; }
    
    // Convert back to RGB values
    const newR = Math.round((rp + m) * 255);
    const newG = Math.round((gp + m) * 255);
    const newB = Math.round((bp + m) * 255);
    
    // Convert to hex
    return '#' + 
      newR.toString(16).padStart(2, '0') + 
      newG.toString(16).padStart(2, '0') + 
      newB.toString(16).padStart(2, '0');
  }

  /**
   * Process job data
   * @param {string} inputData - Tab-separated job data
   * @param {boolean} forceOverwrite - Whether to skip overwrite confirmation
   * @returns {ProcessingResult} Processing result
   */
  process(inputData, forceOverwrite = false) {
    Logger.log(`[JobProcessor] Starting ${this.jobType} data processing...`);
    
    if (!inputData) {
      Logger.log('[JobProcessor] Error: No data provided');
      throw new Error('No data provided');
    }

    try {
      this.validateSheet();
      Logger.log('[JobProcessor] Sheet validation passed');
      
      const hasExistingData = this.checkExistingData(this.range, forceOverwrite);
      Logger.log(`[JobProcessor] Existing data check: ${hasExistingData}`);
      
      const processedData = this.parseInputData(inputData);
      Logger.log(`[JobProcessor] Parsed ${processedData.length} data rows`);
      
      if (processedData.length === 0) {
        Logger.log('[JobProcessor] Error: No valid data rows found');
        throw new Error('No valid data rows found');
      }

      return this.writeData(processedData, hasExistingData);
    } catch (error) {
      Logger.log(`[JobProcessor] Processing error: ${error}`);
      if (error.stack) {
        Logger.log(`[JobProcessor] Stack trace: ${error.stack}`);
      }
      throw error;
    }
  }

  /**
   * Parse input data into rows
   * @private
   * @param {string} inputData - Tab-separated data
   * @returns {Array<Array<any>>} Processed data rows
   */
  parseInputData(inputData) {
    const rows = inputData.split('\n');
    const processedData = [];
    let skippedRows = 0;
    
    // Skip header row and process data
    for (let i = 1; i < rows.length; i++) {
      const columns = rows[i].split('\t');
      
      // Special handling for BPC_BPO type
      if (this.jobType === 'BPC_BPO') {
        if (columns.length >= 2) {
          const runs = parseFloat(columns[1]) || 0;
          if (runs > 0) {
            const data = [
              columns[0],  // BPC name
              runs        // Runs
            ];
            processedData.push({
              data,
              subcategory: columns[2] || 'Blueprint Copies' // Use provided subcategory or default
            });
          } else {
            skippedRows++;
          }
        } else {
          skippedRows++;
        }
      } else {
        // Standard job processing
        if (columns.length >= 5) {
          const runs = parseFloat(columns[1]) || 0;
          if (runs > 0) {
            const data = [
              columns[0],  // Name
              runs,       // Runs
              parseFloat(columns[2]) || 0,  // Days
              parseFloat(columns[3]) || 0   // Job Cost
            ];
            processedData.push({
              data,
              subcategory: columns[4]
            });
          } else {
            skippedRows++;
          }
        } else {
          skippedRows++;
        }
      }
    }
    
    return processedData;
  }

  /**
   * Write processed data to sheet
   * @private
   * @param {Array<Array<any>>} processedData - Data to write
   * @param {boolean} hasExistingData - Whether there was existing data
   * @returns {Promise<ProcessingResult>} Processing result
   */
  async writeData(processedData, hasExistingData) {
    Logger.log(`[JobProcessor] Writing ${processedData.length} rows of data`);
    try {
      const startRow = this.range.getRow() + 1; // Skip header
      const startColumn = this.range.getColumn();
      const templateRow = startRow;
      
      // Determine number of columns based on processed data
      const dataColumns = processedData[0]?.data.length || 0;
      const totalColumns = this.range.getLastColumn() - this.range.getColumn() + 1; // Use full range width
      Logger.log(`[JobProcessor] Using ${dataColumns} data columns and ${totalColumns} total columns for ${this.jobType}`);

      // Get template background color and formatting
      const templateRange = this.sheet.getRange(templateRow, startColumn, 1, totalColumns);
      const baseColor = templateRange.getBackground();
      
      // Group and sort data by subcategory
      const subcategories = new Map();
      processedData.forEach((item, index) => {
        const { data, subcategory } = item;
        const actualSubcategory = this.jobType === 'BPC_BPO' ? subcategory : data[4] || subcategory;
        if (!subcategories.has(actualSubcategory)) {
          subcategories.set(actualSubcategory, []);
        }
        subcategories.get(actualSubcategory).push({ data, originalIndex: index });
      });

      // Sort subcategories alphabetically and create new sorted data array
      const sortedData = Array.from(subcategories.entries())
        .sort(([catA], [catB]) => {
          // For BPC_BPO type, ensure PRODUCTS are at the end
          if (this.jobType === 'BPC_BPO') {
            const isProductA = catA.toLowerCase().includes('product');
            const isProductB = catB.toLowerCase().includes('product');
            if (isProductA !== isProductB) {
              return isProductA ? 1 : -1; // Products go to the end
            }
          }
          return catA.localeCompare(catB);
        })
        .flatMap(([subcategory, items]) => items.map(item => ({
          data: item.data,
          subcategory
        })));

      // Clear and write data
      if (hasExistingData) {
        Logger.log('[JobProcessor] Clearing existing data...');
        const clearRange = this.sheet.getRange(startRow, startColumn, this.range.getHeight() - 1, dataColumns);
        clearRange.clearContent();
      }

      Logger.log('[JobProcessor] Applying formatting...');
      // Copy base formatting from template for all columns
      templateRange.copyTo(
        this.sheet.getRange(
          startRow,
          startColumn,
          sortedData.length,
          totalColumns
        )
      );

      // Write the sorted data (only the data columns)
      Logger.log(`[JobProcessor] Writing data to range: Row ${startRow}, Column ${startColumn}, Height ${processedData.length}, Width ${dataColumns}`);
      const writeRange = this.sheet.getRange(startRow, startColumn, sortedData.length, dataColumns);
      writeRange.setValues(sortedData.map(item => item.data));

      // Apply number formatting
      if (this.jobType === 'BPC_BPO') {
        // Format runs column
        this.sheet.getRange(startRow, startColumn + 1, sortedData.length, 1)
          .setNumberFormat('#,##0');

        // Get blueprint info for all jobs
        const blueprintNames = sortedData.map(item => item.data[0].replace(/ Blueprint$/, ''));
        const blueprintInfoMap = await ESIManager.getBlueprintsByNames(blueprintNames);

        // Calculate and set type and remuneration for each row
        sortedData.forEach((item, index) => {
          const baseName = item.data[0].replace(/ Blueprint$/, ''); 
          const blueprintInfo = blueprintInfoMap.get(baseName);
          const copyingTime = blueprintInfo?.copyingTime || 0;
          const jobDurationDays = Math.round((copyingTime / (24 * 60 * 60)) * 10000) / 10000; // Convert seconds to days and truncate to 4 decimals

          const currentRow = startRow + index;
          const runsColumn = this.columnToLetter(startColumn + 1);  // Runs column
          const dailyLocationFee = CONFIG.FEES.DAILY_LOCATION;
          const runRates = CONFIG.FEES.RUN_RATES;

          // Set remuneration formula using A1 notation
          const remunerationCell = this.sheet.getRange(currentRow, startColumn + 4, 1, 1);
          const formula = `=VLOOKUP(D${currentRow},${runRates},2,FALSE)*${runsColumn}${currentRow}`;
          remunerationCell.setFormula(formula);
          remunerationCell.setNumberFormat('#,##0.00');
        });
      } else {
        // Standard number formatting for other job types
        const formats = {
          runs: '#,##0',      // Runs column
          days: '#,##0.00',   // Days column
          jobCost: '#,##0.00' // Job Cost column
        };

        Object.entries(formats).forEach(([_, format], index) => {
          this.sheet.getRange(startRow, startColumn + index + 1, sortedData.length, 1)
            .setNumberFormat(format);
        });
      }

      // Apply background colors to sorted data
      let subCategoryIndex = 0;
      let currentSubcategory = null;
      
      // First, collect all rows for each subcategory
      const rowsBySubcategory = new Map();
      sortedData.forEach((item, index) => {
        if (!rowsBySubcategory.has(item.subcategory)) {
          rowsBySubcategory.set(item.subcategory, []);
        }
        rowsBySubcategory.get(item.subcategory).push(startRow + index);
      });

      // Then apply colors by subcategory
      Array.from(rowsBySubcategory.entries()).forEach(([subcategory, rows], index) => {
        const colorFactor = index * 0.5;
        const adjustedColor = this.adjustColor(baseColor, colorFactor);
        
        // Apply color to all rows of this subcategory at once
        const rowRanges = rows.map(row => 
          this.sheet.getRange(row, startColumn, 1, totalColumns)
        );
        rowRanges.forEach(range => range.setBackground(adjustedColor));
      });
      
      Logger.log('[JobProcessor] Data write completed successfully');
      return {
        success: true,
        rowsProcessed: sortedData.length,
        details: {
          writeRange: writeRange.getA1Notation()
        }
      };
    } catch (error) {
      Logger.log(`[JobProcessor] Error writing data: ${error}`);
      if (error.stack) {
        Logger.log(`[JobProcessor] Stack trace: ${error.stack}`);
      }
      throw error;
    }
  }

  /**
   * Convert column number to letter (e.g., 1 -> A, 2 -> B, etc.)
   * @private
   * @param {number} column - Column number (1-based)
   * @returns {string} Column letter
   */
  columnToLetter(column) {
    let temp, letter = '';
    while (column > 0) {
      temp = (column - 1) % 26;
      letter = String.fromCharCode(temp + 65) + letter;
      column = (column - temp - 1) / 26;
    }
    return letter;
  }
}

/**
 * Main class for handling user inputs
 */
class UserInputs {
  /**
   * Process material data from text input
   * @param {string} inputData - Tab-separated material data
   * @param {boolean} [forceOverwrite=false] - Whether to overwrite existing data without prompting
   * @returns {ProcessingResult} Processing result
   */
  static processMaterialData(inputData, forceOverwrite = false) {
    const sheet = SpreadsheetApp.getActiveSheet();
    const processor = new MaterialProcessor(sheet);
    return processor.process(inputData, forceOverwrite);
  }

  /**
   * Process job data from text input
   * @param {string} inputData - Tab-separated job data
   * @param {string} jobType - Type of job (REACTIONS, COMPONENTS, PRODUCTS)
   * @param {boolean} [forceOverwrite=false] - Whether to overwrite existing data without prompting
   * @returns {ProcessingResult} Processing result
   */
  static processJobData(inputData, jobType, forceOverwrite = false) {
    Logger.log(`[UserInputs] Processing ${jobType} data with forceOverwrite=${forceOverwrite}`);
    const sheet = SpreadsheetApp.getActiveSheet();
    Logger.log(`[UserInputs] Active sheet name: ${sheet.getName()}`);

    if (!CONFIG.RANGES[jobType]) {
      Logger.log(`[UserInputs] Error: Invalid job type ${jobType}. Available types: ${Object.keys(CONFIG.RANGES).join(', ')}`);
      throw new Error(`Invalid job type: ${jobType}`);
    }

    Logger.log(`[UserInputs] Getting range for ${jobType}: ${CONFIG.RANGES[jobType]}`);
    const processor = new JobProcessor(sheet, jobType);
    return processor.process(inputData, forceOverwrite);
  }

  /**
   * Process Ravworks project import
   * @param {string} projectUrl - The project URL or ID
   * @returns {Promise<ImportResult>} Import result
   */
  static async processRavworksImport(projectUrl) {
    Logger.log(`[UserInputs] Starting Ravworks import for URL/ID: ${projectUrl}`);
    try {
      let projectId = projectUrl;
      
      if (projectUrl.includes('ravworks.com')) {
        projectId = RavworksManager.getProjectIdFromUrl(projectUrl);
        Logger.log(`[UserInputs] Extracted project ID: ${projectId}`);
      }

      Logger.log('[UserInputs] Fetching project data...');
      const result = await RavworksManager.getProject(projectId);
      const projectData = result.data;
      Logger.log(`[UserInputs] Project data received. Jobs: ${Object.keys(projectData.jobs || {}).length}, Materials: ${projectData.materials?.length || 0}`);

      const jobResults = { reactions: 0, components: 0, products: 0 };
      
      // Initialize job categories dynamically
      const mappedJobs = {
        reactions: new Map(),
        components: new Map(),
        products: new Map()
      };

      // Process all jobs and map them to correct categories
      let totalJobs = 0;
      Object.values(projectData.jobs || {}).forEach(jobList => {
        jobList.forEach(job => {
          totalJobs++;
          const category = job.category.toLowerCase();
          Logger.log(`[UserInputs] Processing job: ${job.name} (Category: ${job.category})`);
          
          let mappedJob = {
            name: job.name,
            runs: job.runs,
            days: job.days,
            jobCost: job.jobCost,
            subcategory: job.category
          };

          if (category.includes('reaction')) {
            if (!mappedJobs.reactions.has(job.category)) {
              mappedJobs.reactions.set(job.category, []);
            }
            mappedJobs.reactions.get(job.category).push(mappedJob);
          } else if (category.includes('component') || job.category === 'Others') {
            if (!mappedJobs.components.has(job.category)) {
              mappedJobs.components.set(job.category, []);
            }
            mappedJobs.components.get(job.category).push(mappedJob);
          } else if (!category.includes('bpc') && !category.includes('bpo')) {
            if (!mappedJobs.products.has(job.category)) {
              mappedJobs.products.set(job.category, []);
            }
            mappedJobs.products.get(job.category).push(mappedJob);
          }
        });
      });

      Logger.log(`[UserInputs] Job categorization complete. Total jobs: ${totalJobs}`);
      Logger.log(`[UserInputs] Jobs by category - Reactions: ${Array.from(mappedJobs.reactions.values()).flat().length}, Components: ${Array.from(mappedJobs.components.values()).flat().length}, Products: ${Array.from(mappedJobs.products.values()).flat().length}`);

      // Process blueprints for components and products
      const bpcJobs = new Map();
      
      // First, consolidate runs by item name
      const consolidatedRuns = new Map();
      // Process components
      for (const [category, jobs] of mappedJobs.components.entries()) {
        for (const job of jobs) {
          const key = job.name;
          if (!consolidatedRuns.has(key)) {
            consolidatedRuns.set(key, {
              name: job.name,
              runs: 0,
              category: category
            });
          }
          consolidatedRuns.get(key).runs += job.runs;
        }
      }
      // Process products
      for (const [category, jobs] of mappedJobs.products.entries()) {
        for (const job of jobs) {
          const key = job.name;
          if (!consolidatedRuns.has(key)) {
            consolidatedRuns.set(key, {
              name: job.name,
              runs: 0,
              category: category
            });
          }
          consolidatedRuns.get(key).runs += job.runs;
        }
      }

      try {
        // Get all blueprint info at once
        const blueprintNames = Array.from(consolidatedRuns.keys());
        const blueprintInfoMap = await ESIManager.getBlueprintsByNames(blueprintNames);
        
        // Process each consolidated component with the blueprint info
        for (const [name, jobInfo] of consolidatedRuns.entries()) {
          const blueprintInfo = blueprintInfoMap.get(name);
          if (blueprintInfo) {
            const maxRuns = blueprintInfo.maxRuns || 1;
            const runsNeeded = jobInfo.runs;
            
            // Calculate how many copies we need
            let remainingRuns = runsNeeded;
            while (remainingRuns > 0) {
              const batchRuns = Math.min(remainingRuns, maxRuns);
              
              // Create BPC job entry for this batch
              const bpcJob = {
                name: jobInfo.name.endsWith(' Blueprint') ? jobInfo.name : `${jobInfo.name} Blueprint`,
                runs: batchRuns,
                days: 0,
                jobCost: 0,
                subcategory: jobInfo.category
              };
              
              // Add to the appropriate subcategory in bpcJobs
              if (!bpcJobs.has(jobInfo.category)) {
                bpcJobs.set(jobInfo.category, []);
              }
              bpcJobs.get(jobInfo.category).push(bpcJob);
              remainingRuns -= batchRuns;
            }
          }
        }
      } catch (error) {
        Logger.log(`[UserInputs] Error processing blueprints: ${error}`);
      }

      // Add BPC jobs to mappedJobs
      if (bpcJobs.size > 0) {
        Logger.log(`[UserInputs] Created ${bpcJobs.size} BPC entries`);
        mappedJobs.bpc = bpcJobs;
      }

      // Process materials
      if (projectData.materials?.length > 0) {
        const materialRows = projectData.materials.map(material => 
          [
            material.name,
            material.toBuy.toString(),
            material.toBuyValue.toString(),
            material.toBuyVolume.toString(),
            material.startAmount.toString(),
            material.endAmount.toString()
          ].join('\t')
        );
        
        const header = ['Name', 'To Buy', 'To Buy (Sell-Value)', 'To Buy (Volume)', 'Start Amount', 'End Amount'].join('\t');
        const materialData = [header, ...materialRows].join('\n');
        
        const materialResult = this.processMaterialData(materialData, true);
        Logger.log(`[UserInputs] Material processing result: ${JSON.stringify(materialResult)}`);
      }

      // Process each job type including BPCs
      const jobTypes = [
        { type: 'REACTIONS', map: mappedJobs.reactions },
        { type: 'COMPONENTS', map: mappedJobs.components },
        { type: 'PRODUCTS', map: mappedJobs.products },
        { type: 'BPC_BPO', map: mappedJobs.bpc }
      ];

      for (const { type, map } of jobTypes) {
        if (!map) {
          Logger.log(`[UserInputs] Skipping ${type} - no jobs found`);
          continue;
        }

        const allJobs = Array.from(map.entries())
          .sort(([catA], [catB]) => catA.localeCompare(catB))
          .flatMap(([subcategory, jobs]) => jobs.map(job => ({
            ...job,
            subcategory
          })));
        
        if (allJobs.length > 0) {
          Logger.log(`[UserInputs] Processing ${allJobs.length} ${type} jobs`);
          
          // Special handling for BPC_BPO type
          if (type === 'BPC_BPO') {
            Logger.log('[UserInputs] Using BPC_BPO specific format');
            
            // Sort jobs by name and runs in descending order
            const sortedJobs = [...allJobs].sort((a, b) => {
              // First sort by name
              const nameCompare = a.name.replace(/ Blueprint Blueprint$/, ' Blueprint')
                                     .localeCompare(b.name.replace(/ Blueprint Blueprint$/, ' Blueprint'));
              if (nameCompare !== 0) return nameCompare;
              
              // Then sort by runs in descending order
              return b.runs - a.runs;
            });

            // Get blueprint info for all jobs
            const blueprintNames = sortedJobs.map(job => job.name.replace(/ Blueprint( Blueprint)?$/, ''));
            const blueprintInfoMap = await ESIManager.getBlueprintsByNames(blueprintNames);

            const jobRows = sortedJobs.map(job => {
              const baseName = job.name.replace(/ Blueprint$/, '');
              const blueprintInfo = blueprintInfoMap.get(baseName);
              const copyingTime = blueprintInfo?.copyingTime || 0;
              const jobDurationDays = Math.round((copyingTime / (24 * 60 * 60)) * 10000) / 10000; // Convert seconds to days and truncate to 4 decimals

              return [
                job.name,           // BPC
                job.runs.toString(), // Run ou cycle par exemplaire
                job.subcategory     // Pass subcategory for coloring
              ].join('\t');
            });
            
            const header = ['BPC', 'Run ou cycle par exemplaire', '_subcategory'].join('\t');
            const jobData = [header, ...jobRows].join('\n');
            
            try {
              Logger.log(`[UserInputs] Sending BPC_BPO data for processing (${jobRows.length} rows)`);
              const jobResult = this.processJobData(jobData, type, true);
              jobResults[type.toLowerCase()] = jobResult.rowsProcessed;
              Logger.log(`[UserInputs] BPC_BPO processing complete. Rows processed: ${jobResult.rowsProcessed}`);
            } catch (error) {
              Logger.log(`[UserInputs] Error processing BPC_BPO jobs: ${error}`);
              if (error.stack) {
                Logger.log(`[UserInputs] Stack trace: ${error.stack}`);
              }
            }
          } else {
            // Standard job processing for other types
            const jobRows = allJobs.map(job => 
              [
                job.name,
                job.runs.toString(),
                job.days.toString(),
                job.jobCost.toString(),
                job.subcategory
              ].join('\t')
            );
            
            const header = ['Name', 'Runs', 'Days', 'Job Cost', '_subcategory'].join('\t');
            const jobData = [header, ...jobRows].join('\n');
            
            try {
              Logger.log(`[UserInputs] Sending ${type} data for processing (${jobRows.length} rows)`);
              const jobResult = this.processJobData(jobData, type, true);
              jobResults[type.toLowerCase()] = jobResult.rowsProcessed;
              Logger.log(`[UserInputs] ${type} processing complete. Rows processed: ${jobResult.rowsProcessed}`);
            } catch (error) {
              Logger.log(`[UserInputs] Error processing ${type} jobs: ${error}`);
              if (error.stack) {
                Logger.log(`[UserInputs] Stack trace: ${error.stack}`);
              }
            }
          }
        } else {
          Logger.log(`[UserInputs] No jobs to process for ${type}`);
        }
      }
      
      return {
        success: true,
        details: {
          materials: projectData.materials?.length || 0,
          jobs: {
            ...jobResults,
            subcategories: Object.fromEntries(
              Object.entries(mappedJobs).map(([type, map]) => [
                type,
                Object.fromEntries(
                  Array.from(map.entries()).map(([category, jobs]) => [category, jobs.length])
                )
              ])
            )
          }
        }
      };
    } catch (error) {
      Logger.log(`[UserInputs] Error processing Ravworks import: ${error}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

/**
 * @typedef {Object} ProcessingResult
 * @property {boolean} success - Whether the processing was successful
 * @property {boolean} existingData - Whether there was existing data
 * @property {number} rowsProcessed - Number of rows processed
 * @property {number} skippedRows - Number of rows skipped
 * @property {Object} details - Additional processing details
 */

/**
 * @typedef {Object} ImportResult
 * @property {boolean} success - Whether the import was successful
 * @property {Object} [details] - Import details if successful
 * @property {string} [error] - Error message if unsuccessful
 */ 