/// <reference types="google-apps-script" />

/**
 * Class to handle user inputs and data processing for the spreadsheet.
 */
class UserInputs {
  /**
   * Handles job input for different categories (BPC/BPO, Reactions, Components, Products)
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet to input jobs into
   * @param {string} jobType - The type of job (BPC_BPO, REACTIONS, COMPONENTS, PRODUCTS)
   */
  static handleJobInput(sheet, jobType) {
    const ui = SpreadsheetApp.getUi();
    const jobRange = sheet.getRange(CONFIG.RANGES[jobType]);
    
    // TODO: Implement job input UI and handling
    // This will be similar to material input but with job-specific fields
    // Will need to handle different job types and their specific requirements
  }

  /**
   * Process material data from text input
   * @param {string} inputData - Tab-separated material data
   * @param {boolean} [forceOverwrite=false] - Whether to overwrite existing data without prompting
   * @returns {ProcessingResult} Processing result with success status and details
   */
  static processMaterialData(inputData, forceOverwrite = false) {
    Logger.log('[UserInputs.processMaterialData] Starting material data processing...');
    
    if (!inputData) {
      Logger.log('[UserInputs.processMaterialData] Error: No data provided');
      throw new Error('No data provided');
    }

    Logger.log('[UserInputs.processMaterialData] Getting active sheet...');
    const sheet = SpreadsheetApp.getActiveSheet();
    
    if (!sheet) {
      Logger.log('[UserInputs.processMaterialData] Error: No active sheet found');
      throw new Error('No active sheet found');
    }
    
    // Prevent modifications to Template tab
    if (sheet.getName() === 'Template') {
      Logger.log('[UserInputs.processMaterialData] Error: Cannot modify Template tab');
      throw new Error('Cannot modify Template tab. Please switch to a different tab before importing.');
    }
    
    Logger.log('[UserInputs.processMaterialData] Getting material range...');
    const materialRange = sheet.getRange(CONFIG.RANGES.MATERIALS);
    Logger.log(`[UserInputs.processMaterialData] Material range: ${materialRange.getA1Notation()}`);
    
    const existingData = materialRange.getValues();
    let hasExistingData = false;
    
    // Check if there is existing data
    hasExistingData = existingData.some(row => row.some(cell => cell !== ''));
    Logger.log(`[UserInputs.processMaterialData] Existing data found: ${hasExistingData}`);
    
    if (hasExistingData && !forceOverwrite) {
      Logger.log('[UserInputs.processMaterialData] Prompting user for overwrite confirmation...');
      const ui = SpreadsheetApp.getUi();
      const response = ui.alert(
        'Existing Data Found',
        'There is existing data in the materials section. Do you want to overwrite it?',
        ui.ButtonSet.YES_NO
      );
      
      if (response !== ui.Button.YES) {
        Logger.log('[UserInputs.processMaterialData] User cancelled operation');
        throw new Error('Operation cancelled by user');
      }
      Logger.log('[UserInputs.processMaterialData] User confirmed overwrite');
    }
    
    if (hasExistingData) {
      Logger.log('[UserInputs.processMaterialData] Clearing existing material data...');
    }
    
    // Process the input data
    Logger.log('[UserInputs.processMaterialData] Splitting input data into rows...');
    const rows = inputData.split('\n');
    Logger.log(`[UserInputs.processMaterialData] Found ${rows.length} total rows (including header)`);
    
    // reorder row by volume
    Logger.log('[UserInputs.processMaterialData] Sorting rows by material volume...');
    rows.sort((a, b) => parseFloat(b.split('\t')[3]) - parseFloat(a.split('\t')[3]));
    
    const processedData = [];
    let skippedRows = 0;
    
    Logger.log(`[UserInputs.processMaterialData] Starting to process ${rows.length - 1} rows of material data...`);
    
    // Skip header row and process data
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const columns = row.split('\t');
      
      if (columns.length >= 6) {
        const toBuy = parseFloat(columns[1]) || 0;
        
        if (toBuy > 0) {
          const processedRow = [
            columns[0],  // Name
            toBuy,  // To Buy
            parseFloat(columns[2].replace(/,/g, '')) || 0,  // To Buy (Sell-Value)
          ];
          processedData.push(processedRow);
          Logger.log(`[UserInputs.processMaterialData] Processed row ${i}: ${processedRow[0]} with ${processedRow[1]} units to buy at ${processedRow[2]} ISK`);
        } else {
          skippedRows++;
          Logger.log(`[UserInputs.processMaterialData] Skipped row ${i}: ${columns[0]} has 0 units to buy`);
        }
      } else {
        skippedRows++;
        Logger.log(`[UserInputs.processMaterialData] Skipped invalid row ${i}: insufficient columns (expected 6, got ${columns.length})`);
      }
    }
    
    if (processedData.length > 0) {
      Logger.log(`[UserInputs.processMaterialData] Processing complete. Writing ${processedData.length} rows to sheet...`);
      
      // Get the starting row for material data (after header)
      const startRow = materialRange.getRow() + 1;  // +1 to skip header
      const startColumn = materialRange.getColumn();
      const materialRangeHeight = materialRange.getHeight();
      const lastRow = materialRange.getRow() + materialRangeHeight - 1;  // -1 because we're using 1-based indexing
      const numRows = materialRangeHeight - 1;  // -1 to account for header
      
      Logger.log(`[UserInputs.processMaterialData] Material range height: ${materialRangeHeight} rows`);
      Logger.log(`[UserInputs.processMaterialData] Current range: Row ${startRow} to ${lastRow} (${numRows} rows)`);
      Logger.log(`[UserInputs.processMaterialData] New data: ${processedData.length} rows`);
      
      try {
        // Clear existing data but preserve headers
        if (hasExistingData) {
          Logger.log('[UserInputs.processMaterialData] Clearing existing content (preserving headers)...');
          const dataRange = sheet.getRange(startRow, startColumn, numRows, 3);
          dataRange.clearContent();
        }
        
        // Refactored formula handling
        if (processedData.length > numRows) {
          const rowsToAdd = processedData.length - numRows;
          Logger.log(`[UserInputs.processMaterialData] Need to extend sheet by ${rowsToAdd} rows (${processedData.length} > ${numRows})`);
          
          // Get template row data
          const templateRow = materialRange.getRow() + 1;
          const fullRowRange = sheet.getRange(templateRow, 1, 1, sheet.getLastColumn());
          const templateFormulas = fullRowRange.getFormulas()[0];
          const templateValues = fullRowRange.getValues()[0];
          
          // Insert new rows
          sheet.insertRowsAfter(lastRow, rowsToAdd);
          
          // Apply template values first
          const newRowsRange = sheet.getRange(lastRow + 1, 1, rowsToAdd, templateFormulas.length);
          newRowsRange.setValues(Array(rowsToAdd).fill(templateValues));
          
          // Then handle formulas
          for (let colIndex = 0; colIndex < templateFormulas.length; colIndex++) {
            const formula = templateFormulas[colIndex];
            if (!formula) continue;  // Skip columns without formulas
            
            // Create array of adjusted formulas for this column
            const formulaArray = [];
            for (let rowOffset = 0; rowOffset < rowsToAdd; rowOffset++) {
              const targetRow = lastRow + 1 + rowOffset;
              let adjustedFormula = formula;
              
              // Find all cell references in the formula and adjust them
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
              
              formulaArray.push([adjustedFormula]);
            }
            
            // Apply formulas for this column
            if (formulaArray.length > 0) {
              const formulaRange = sheet.getRange(lastRow + 1, colIndex + 1, rowsToAdd, 1);
              formulaRange.setFormulas(formulaArray);
            }
          }
          
          Logger.log(`[UserInputs.processMaterialData] Extended ${rowsToAdd} rows with formulas and values`);
        }
        
        // Get the exact range for writing (starting after header)
        const writeRange = sheet.getRange(startRow, startColumn, processedData.length, 3);
        Logger.log(`[UserInputs.processMaterialData] Write range: ${writeRange.getA1Notation()}`);
        
        // Write values
        Logger.log('[UserInputs.processMaterialData] Setting new values...');
        writeRange.setValues(processedData);
        
        // Apply formatting
        Logger.log('[UserInputs.processMaterialData] Applying number formatting...');
        sheet.getRange(startRow, startColumn + 1, processedData.length, 1).setNumberFormat('#,##0');  // To Buy
        sheet.getRange(startRow, startColumn + 2, processedData.length, 1).setNumberFormat('#,##0.00');  // To Buy (Sell-Value)
        
        // Verify write
        const writtenValues = writeRange.getValues();
        Logger.log(`[UserInputs.processMaterialData] Verification - Written ${writtenValues.length} rows`);
        if (writtenValues.length !== processedData.length) {
          Logger.log('[UserInputs.processMaterialData] Warning: Written row count does not match processed data');
        }
      } catch (error) {
        Logger.log(`[UserInputs.processMaterialData] Error writing to sheet: ${error}`);
        throw new Error(`Failed to write data to sheet: ${error.message}`);
      }
      
      Logger.log('[UserInputs.processMaterialData] Material data import completed successfully');
      
      const result = {
        success: true,
        existingData: hasExistingData,
        rowsProcessed: processedData.length,
        skippedRows: skippedRows,
        details: {
          totalRows: rows.length - 1, // Subtract header row
          validRows: processedData.length,
          invalidRows: skippedRows,
          columnsProcessed: 6,
          writeRange: sheet.getRange(startRow, startColumn, processedData.length, 3).getA1Notation()
        }
      };
      
      Logger.log(`[UserInputs.processMaterialData] Final result: ${JSON.stringify(result)}`);
      return result;
    } else {
      Logger.log('[UserInputs.processMaterialData] Error: No valid data rows found');
      throw new Error('No valid data rows found');
    }
  }

  /**
   * Process job data from text input for a specific job type
   * @param {string} inputData - Tab-separated job data
   * @param {string} jobType - Type of job (REACTIONS, COMPONENTS, PRODUCTS)
   * @param {boolean} [forceOverwrite=false] - Whether to overwrite existing data without prompting
   * @returns {ProcessingResult} Processing result with success status and details
   */
  static processJobData(inputData, jobType, forceOverwrite = false) {
    Logger.log(`[UserInputs.processJobData] Starting ${jobType} data processing...`);
    
    if (!inputData) {
      Logger.log('[UserInputs.processJobData] Error: No data provided');
      throw new Error('No data provided');
    }

    if (!['REACTIONS', 'COMPONENTS', 'PRODUCTS'].includes(jobType)) {
      Logger.log(`[UserInputs.processJobData] Error: Invalid job type: ${jobType}`);
      throw new Error('Invalid job type. Must be one of: REACTIONS, COMPONENTS, PRODUCTS');
    }

    Logger.log('[UserInputs.processJobData] Getting active sheet...');
    const sheet = SpreadsheetApp.getActiveSheet();
    
    if (!sheet) {
      Logger.log('[UserInputs.processJobData] Error: No active sheet found');
      throw new Error('No active sheet found');
    }
    
    // Prevent modifications to Template tab
    if (sheet.getName() === 'Template') {
      Logger.log('[UserInputs.processJobData] Error: Cannot modify Template tab');
      throw new Error('Cannot modify Template tab. Please switch to a different tab before importing.');
    }
    
    Logger.log(`[UserInputs.processJobData] Getting ${jobType} range...`);
    const jobRange = sheet.getRange(CONFIG.RANGES[jobType]);
    Logger.log(`[UserInputs.processJobData] Job range: ${jobRange.getA1Notation()}`);
    
    const existingData = jobRange.getValues();
    let hasExistingData = false;
    
    // Check if there is existing data
    hasExistingData = existingData.some(row => row.some(cell => cell !== ''));
    Logger.log(`[UserInputs.processJobData] Existing data found: ${hasExistingData}`);
    
    if (hasExistingData && !forceOverwrite) {
      Logger.log('[UserInputs.processJobData] Prompting user for overwrite confirmation...');
      const ui = SpreadsheetApp.getUi();
      const response = ui.alert(
        'Existing Data Found',
        `There is existing data in the ${jobType.toLowerCase()} section. Do you want to overwrite it?`,
        ui.ButtonSet.YES_NO
      );
      
      if (response !== ui.Button.YES) {
        Logger.log('[UserInputs.processJobData] User cancelled operation');
        throw new Error('Operation cancelled by user');
      }
      Logger.log('[UserInputs.processJobData] User confirmed overwrite');
    }
    
    if (hasExistingData) {
      Logger.log(`[UserInputs.processJobData] Clearing existing ${jobType} data...`);
    }
    
    // Process the input data
    Logger.log('[UserInputs.processJobData] Splitting input data into rows...');
    const rows = inputData.split('\n');
    Logger.log(`[UserInputs.processJobData] Found ${rows.length} total rows (including header)`);
    
    // Sort rows by runs for efficiency
    Logger.log('[UserInputs.processJobData] Sorting rows by number of runs...');
    rows.sort((a, b) => parseFloat(b.split('\t')[1]) - parseFloat(a.split('\t')[1]));
    
    const processedData = [];
    let skippedRows = 0;
    
    Logger.log(`[UserInputs.processJobData] Starting to process ${rows.length - 1} rows of ${jobType} data...`);
    
    // Skip header row and process data
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const columns = row.split('\t');
      
      if (columns.length >= 4) {  // Name, Runs, ME, TE
        const runs = parseFloat(columns[1]) || 0;
        
        if (runs > 0) {
          const processedRow = [
            columns[0],  // Name
            runs,        // Runs
            parseFloat(columns[2]) || 0,  // ME
            parseFloat(columns[3]) || 0   // TE
          ];
          processedData.push(processedRow);
          Logger.log(`[UserInputs.processJobData] Processed row ${i}: ${processedRow[0]} with ${processedRow[1]} runs`);
        } else {
          skippedRows++;
          Logger.log(`[UserInputs.processJobData] Skipped row ${i}: ${columns[0]} has 0 runs`);
        }
      } else {
        skippedRows++;
        Logger.log(`[UserInputs.processJobData] Skipped invalid row ${i}: insufficient columns (expected 4, got ${columns.length})`);
      }
    }
    
    if (processedData.length > 0) {
      Logger.log(`[UserInputs.processJobData] Processing complete. Writing ${processedData.length} rows to sheet...`);
      
      // Get the starting row for job data (after header)
      const startRow = jobRange.getRow() + 1;  // +1 to skip header
      const startColumn = jobRange.getColumn();
      const jobRangeHeight = jobRange.getHeight();
      const lastRow = jobRange.getRow() + jobRangeHeight - 1;
      const numRows = jobRangeHeight - 1;  // -1 to account for header
      
      Logger.log(`[UserInputs.processJobData] Job range height: ${jobRangeHeight} rows`);
      Logger.log(`[UserInputs.processJobData] Current range: Row ${startRow} to ${lastRow} (${numRows} rows)`);
      Logger.log(`[UserInputs.processJobData] New data: ${processedData.length} rows`);
      
      try {
        // Clear existing data but preserve headers
        if (hasExistingData) {
          Logger.log('[UserInputs.processJobData] Clearing existing content (preserving headers)...');
          const dataRange = sheet.getRange(startRow, startColumn, numRows, 4);
          dataRange.clearContent();
        }
        
        // Handle extending the sheet if needed
        if (processedData.length > numRows) {
          const rowsToAdd = processedData.length - numRows;
          Logger.log(`[UserInputs.processJobData] Need to extend sheet by ${rowsToAdd} rows (${processedData.length} > ${numRows})`);
          
          // Get template row data
          const templateRow = jobRange.getRow() + 1;
          const fullRowRange = sheet.getRange(templateRow, 1, 1, sheet.getLastColumn());
          const templateFormulas = fullRowRange.getFormulas()[0];
          const templateValues = fullRowRange.getValues()[0];
          
          // Insert new rows
          sheet.insertRowsAfter(lastRow, rowsToAdd);
          
          // Apply template values first
          const newRowsRange = sheet.getRange(lastRow + 1, 1, rowsToAdd, templateFormulas.length);
          newRowsRange.setValues(Array(rowsToAdd).fill(templateValues));
          
          // Then handle formulas
          for (let colIndex = 0; colIndex < templateFormulas.length; colIndex++) {
            const formula = templateFormulas[colIndex];
            if (!formula) continue;  // Skip columns without formulas
            
            // Create array of adjusted formulas for this column
            const formulaArray = [];
            for (let rowOffset = 0; rowOffset < rowsToAdd; rowOffset++) {
              const targetRow = lastRow + 1 + rowOffset;
              let adjustedFormula = formula;
              
              // Find all cell references in the formula and adjust them
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
              
              formulaArray.push([adjustedFormula]);
            }
            
            // Apply formulas for this column
            if (formulaArray.length > 0) {
              const formulaRange = sheet.getRange(lastRow + 1, colIndex + 1, rowsToAdd, 1);
              formulaRange.setFormulas(formulaArray);
            }
          }
          
          Logger.log(`[UserInputs.processJobData] Extended ${rowsToAdd} rows with formulas and values`);
        }
        
        // Get the exact range for writing (starting after header)
        const writeRange = sheet.getRange(startRow, startColumn, processedData.length, 4);
        Logger.log(`[UserInputs.processJobData] Write range: ${writeRange.getA1Notation()}`);
        
        // Write values
        Logger.log('[UserInputs.processJobData] Setting new values...');
        writeRange.setValues(processedData);
        
        // Apply formatting
        Logger.log('[UserInputs.processJobData] Applying number formatting...');
        sheet.getRange(startRow, startColumn + 1, processedData.length, 1).setNumberFormat('#,##0');  // Runs
        sheet.getRange(startRow, startColumn + 2, processedData.length, 1).setNumberFormat('0.##');   // ME
        sheet.getRange(startRow, startColumn + 3, processedData.length, 1).setNumberFormat('0.##');   // TE
        
        // Verify write
        const writtenValues = writeRange.getValues();
        Logger.log(`[UserInputs.processJobData] Verification - Written ${writtenValues.length} rows`);
        if (writtenValues.length !== processedData.length) {
          Logger.log('[UserInputs.processJobData] Warning: Written row count does not match processed data');
        }
      } catch (error) {
        Logger.log(`[UserInputs.processJobData] Error writing to sheet: ${error}`);
        throw new Error(`Failed to write data to sheet: ${error.message}`);
      }
      
      Logger.log(`[UserInputs.processJobData] ${jobType} data import completed successfully`);
      
      const result = {
        success: true,
        existingData: hasExistingData,
        rowsProcessed: processedData.length,
        skippedRows: skippedRows,
        details: {
          jobType: jobType,
          totalRows: rows.length - 1,
          validRows: processedData.length,
          invalidRows: skippedRows,
          columnsProcessed: 4,
          writeRange: sheet.getRange(startRow, startColumn, processedData.length, 4).getA1Notation()
        }
      };
      
      Logger.log(`[UserInputs.processJobData] Final result: ${JSON.stringify(result)}`);
      return result;
    } else {
      Logger.log('[UserInputs.processJobData] Error: No valid data rows found');
      throw new Error('No valid data rows found');
    }
  }

  /**
   * Process the Ravworks project import
   * @param {string} projectUrl - The project URL or ID
   * @returns {Promise<ImportResult>} Import result with success status and details
   */
  static async processRavworksImport(projectUrl) {
    Logger.log(`[UserInputs] Starting Ravworks import for URL/ID: ${projectUrl}`);
    try {
      let projectId = projectUrl;
      
      // If a full URL was provided, extract the project ID
      if (projectUrl.includes('ravworks.com')) {
        Logger.log('[UserInputs] URL provided, extracting project ID...');
        projectId = RavworksManager.getProjectIdFromUrl(projectUrl);
        Logger.log(`[UserInputs] Extracted project ID: ${projectId}`);
      }

      Logger.log('[UserInputs] Fetching project data from Ravworks...');
      const result = await RavworksManager.getProject(projectId);
      Logger.log(`[UserInputs] Successfully fetched project data`);
      
      const projectData = result.data;
      const jobResults = { reactions: 0, components: 0, products: 0 };
      
      // Update materials using processMaterialData
      if (projectData.materials && projectData.materials.length > 0) {
        Logger.log('[UserInputs] Starting materials import...');
        
        // Convert materials to tab-separated format
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
        
        // Add header row
        const header = ['Name', 'To Buy', 'To Buy (Sell-Value)', 'To Buy (Volume)', 'Start Amount', 'End Amount'].join('\t');
        const materialData = [header, ...materialRows].join('\n');
        
        // Process materials using existing method with forceOverwrite=true
        Logger.log('[UserInputs] Processing materials using processMaterialData...');
        const materialResult = this.processMaterialData(materialData, true);  // Force overwrite without prompting
        Logger.log(`[UserInputs] Material processing result: ${JSON.stringify(materialResult)}`);
      } else {
        Logger.log('[UserInputs] No materials found to import');
      }

      // Process Reactions
      if (projectData.jobs?.reactions?.length > 0) {
        Logger.log('[UserInputs] Starting reactions import...');
        const reactionRows = projectData.jobs.reactions.map(job => 
          [
            job.name,
            job.runs.toString(),
            job.me.toString(),
            job.te.toString()
          ].join('\t')
        );
        
        const reactionHeader = ['Name', 'Runs', 'ME', 'TE'].join('\t');
        const reactionData = [reactionHeader, ...reactionRows].join('\n');
        
        Logger.log('[UserInputs] Processing reactions using processJobData...');
        const reactionResult = this.processJobData(reactionData, 'REACTIONS', true);
        jobResults.reactions = reactionResult.rowsProcessed;
        Logger.log(`[UserInputs] Reaction processing result: ${JSON.stringify(reactionResult)}`);
      } else {
        Logger.log('[UserInputs] No reactions found to import');
      }

      // Process Components
      if (projectData.jobs?.components?.length > 0) {
        Logger.log('[UserInputs] Starting components import...');
        const componentRows = projectData.jobs.components.map(job => 
          [
            job.name,
            job.runs.toString(),
            job.me.toString(),
            job.te.toString()
          ].join('\t')
        );
        
        const componentHeader = ['Name', 'Runs', 'ME', 'TE'].join('\t');
        const componentData = [componentHeader, ...componentRows].join('\n');
        
        Logger.log('[UserInputs] Processing components using processJobData...');
        const componentResult = this.processJobData(componentData, 'COMPONENTS', true);
        jobResults.components = componentResult.rowsProcessed;
        Logger.log(`[UserInputs] Component processing result: ${JSON.stringify(componentResult)}`);
      } else {
        Logger.log('[UserInputs] No components found to import');
      }

      // Process Products
      if (projectData.jobs?.products?.length > 0) {
        Logger.log('[UserInputs] Starting products import...');
        const productRows = projectData.jobs.products.map(job => 
          [
            job.name,
            job.runs.toString(),
            job.me.toString(),
            job.te.toString()
          ].join('\t')
        );
        
        const productHeader = ['Name', 'Runs', 'ME', 'TE'].join('\t');
        const productData = [productHeader, ...productRows].join('\n');
        
        Logger.log('[UserInputs] Processing products using processJobData...');
        const productResult = this.processJobData(productData, 'PRODUCTS', true);
        jobResults.products = productResult.rowsProcessed;
        Logger.log(`[UserInputs] Product processing result: ${JSON.stringify(productResult)}`);
      } else {
        Logger.log('[UserInputs] No products found to import');
      }

      const totalJobs = jobResults.reactions + jobResults.components + jobResults.products;
      Logger.log(`[UserInputs] Import completed successfully. ${projectData.materials?.length || 0} materials and ${totalJobs} total jobs imported`);
      
      return {
        success: true,
        details: {
          materials: projectData.materials?.length || 0,
          jobs: jobResults
        }
      };
    } catch (error) {
      Logger.log(`[UserInputs] Error processing Ravworks import: ${error}`);
      Logger.log(`[UserInputs] Stack trace: ${error.stack}`);
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