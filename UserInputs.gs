class UserInputs {
  /**
   * Handles material input through a modal dialog
   */
  static handleMaterialInput() {
    const ui = SpreadsheetApp.getUi();
    const sheet = SpreadsheetApp.getActiveSheet();
    const materialRange = sheet.getRange(CONFIG.RANGES.MATERIALS);
    
    const html = HtmlService.createHtmlOutput(`
      <style>
        body { 
          font-family: Arial, sans-serif; 
          padding: 20px;
          margin: 0;
          line-height: 1.6;
        }
        .container {
          max-width: 100%;
          margin: 0 auto;
          display: grid;
          grid-template-rows: auto 1fr auto;
          gap: 15px;
        }
        .instructions { 
          background: #f8f9fa;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 15px;
          font-size: 14px;
          color: #555;
        }
        .format-example {
          font-family: monospace;
          background: #fff;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          margin: 8px 0;
          font-size: 13px;
        }
        .input-section {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        textarea { 
          width: 100%;
          height: 150px;
          padding: 8px;
          font-family: monospace;
          font-size: 13px;
          border: 1px solid #ddd;
          border-radius: 4px;
          resize: vertical;
        }
        .log-section {
          margin-top: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          height: 100px;
          overflow-y: auto;
          background: #f8f9fa;
          padding: 8px;
          font-family: monospace;
          font-size: 12px;
        }
        .log-entry {
          margin: 2px 0;
          padding: 2px 4px;
        }
        .log-info { color: #0d6efd; }
        .log-success { color: #198754; }
        .log-error { color: #dc3545; }
        .log-warning { color: #ffc107; }
        .button-group {
          display: flex;
          gap: 10px;
          margin-top: 15px;
        }
        button { 
          flex: 1;
          padding: 8px 15px;
          cursor: pointer;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          transition: background-color 0.2s;
        }
        .primary {
          background: #4285f4;
          color: white;
        }
        .primary:hover {
          background: #3b78e7;
        }
        .secondary {
          background: #f1f3f4;
          color: #333;
        }
        .secondary:hover {
          background: #e8eaed;
        }
        #loading { 
          display: none;
          align-items: center;
          gap: 10px;
          color: #666;
          margin-top: 15px;
          justify-content: center;
        }
        .spinner {
          width: 20px;
          height: 20px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #3498db;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>

      <div class="container">
        <div class="instructions">
          Paste your material data in tab-separated format:
          <div class="format-example">
            Name | To Buy | To Buy (Sell-Value) | To Buy Volume | Start Amount | End Amount
          </div>
        </div>

        <div class="input-section">
          <textarea id="materialData" placeholder="Paste your data here..."></textarea>
          <div id="logSection" class="log-section"></div>
        </div>

        <div class="button-group">
          <button onclick="submitData()" id="submitBtn" class="primary">Import Materials</button>
          <button onclick="google.script.host.close()" class="secondary">Cancel</button>
        </div>

        <div id="loading">
          <div class="spinner"></div>
          <span>Processing materials...</span>
        </div>
      </div>

      <script>
        function addLog(message, type = 'info') {
          const logSection = document.getElementById('logSection');
          const entry = document.createElement('div');
          entry.className = 'log-entry log-' + type;
          entry.textContent = message;
          logSection.appendChild(entry);
          logSection.scrollTop = logSection.scrollHeight;
        }

        function validateData(data) {
          const lines = data.trim().split('\\n');
          const errors = [];
          
          if (lines.length === 0) {
            errors.push('No data provided');
            return { valid: false, errors };
          }

          lines.forEach((line, index) => {
            const columns = line.split('\\t');
            // Skip first line
            if (index === 0) {
              return;
            }
            if (columns.length !== 6) {
              errors.push(\`Line \${index + 1}: Expected 6 columns (Name, To Buy, To Buy (Sell-Value), To Buy Volume, Start Amount, End Amount), got \${columns.length}\`);
              return;
            }

            // Name validation (column 0)
            if (!columns[0] || columns[0].trim() === '') {
              errors.push(\`Line \${index + 1}: Name is required\`);
            }

            // To Buy validation (column 1)
            const toBuy = parseFloat(columns[1].replace(/,/g, ''));
            if (isNaN(toBuy)) {
              errors.push(\`Line \${index + 1}: 'To Buy' must be a number, got '\${columns[1]}'\`);
            }

            // To Buy (Sell-Value) validation (column 2)
            const sellValue = parseFloat(columns[2].replace(/,/g, ''));
            if (isNaN(sellValue)) {
              errors.push(\`Line \${index + 1}: 'To Buy (Sell-Value)' must be a number, got '\${columns[2]}'\`);
            }

            // To Buy Volume validation (column 3)
            const volume = parseFloat(columns[3].replace(/,/g, ''));
            if (isNaN(volume)) {
              errors.push(\`Line \${index + 1}: 'To Buy Volume' must be a number, got '\${columns[3]}'\`);
            }

            // Start Amount validation (column 4)
            const startAmount = parseFloat(columns[4].replace(/,/g, ''));
            if (isNaN(startAmount)) {
              errors.push(\`Line \${index + 1}: 'Start Amount' must be a number, got '\${columns[4]}'\`);
            }

            // End Amount validation (column 5)
            const endAmount = parseFloat(columns[5].replace(/,/g, ''));
            if (isNaN(endAmount)) {
              errors.push(\`Line \${index + 1}: 'End Amount' must be a number, got '\${columns[5]}'\`);
            }
          });

          return {
            valid: errors.length === 0,
            errors,
            lineCount: lines.length
          };
        }

        function submitData() {
          const data = document.getElementById('materialData').value;
          if (!data.trim()) {
            addLog('Please paste material data first', 'error');
            return;
          }
          
          addLog('Validating input data...');
          const validation = validateData(data);
          
          if (!validation.valid) {
            validation.errors.forEach(error => addLog(error, 'error'));
            return;
          }
          
          addLog(\`Found \${validation.lineCount} valid material entries\`, 'success');
          addLog('Starting import process...');
          
          // Show loading state
          document.getElementById('loading').style.display = 'flex';
          document.getElementById('submitBtn').disabled = true;
          document.getElementById('materialData').disabled = true;
          
          google.script.run
            .withSuccessHandler(function(result) {
              if (result.existingData) {
                addLog('Found existing data in sheet', 'warning');
              }
              
              // Log detailed import information
              addLog(\`Processing \${result.details.totalRows} total rows...\`);
              addLog(\`Successfully processed \${result.details.validRows} valid rows\`, 'success');
              
              if (result.details.invalidRows > 0) {
                addLog(\`Skipped \${result.details.invalidRows} invalid rows\`, 'warning');
              }
              
              addLog(\`Processed \${result.details.columnsProcessed} columns per row\`, 'info');
              
              if (result.success) {
                addLog('Import completed successfully!', 'success');
                addLog('Formatting applied to all columns', 'info');
                setTimeout(() => {
                  google.script.host.close();
                }, 1500);
              }
            })
            .withFailureHandler(function(error) {
              addLog('Error: ' + error, 'error');
              document.getElementById('loading').style.display = 'none';
              document.getElementById('submitBtn').disabled = false;
              document.getElementById('materialData').disabled = false;
            })
            .processMaterialData(data);
        }
      </script>
    `)
      .setWidth(800)
      .setHeight(500)
      .setTitle('Import Materials');
    
    ui.showModalDialog(html, 'Import Materials');
  }

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
   * Process the material data and update the sheet
   * @param {string} inputData - Tab-separated material data
   * @returns {Object} Processing result with success status and details
   */
  static processMaterialData(inputData) {
    if (!inputData) {
      throw new Error('No data provided');
    }

    const sheet = SpreadsheetApp.getActiveSheet();
    
    if (!sheet) {
      throw new Error('No active sheet found');
    }
    
    const materialRange = sheet.getRange(CONFIG.RANGES.MATERIALS);
    const existingData = materialRange.getValues();
    let hasExistingData = false;
    
    // Check if there is existing data
    hasExistingData = existingData.some(row => row.some(cell => cell !== ''));
    
    if (hasExistingData) {
      const ui = SpreadsheetApp.getUi();
      const response = ui.alert(
        'Existing Data Found',
        'There is existing data in the materials section. Do you want to overwrite it?',
        ui.ButtonSet.YES_NO
      );
      
      if (response !== ui.Button.YES) {
        throw new Error('Operation cancelled by user');
      }
      
      Logger.log('Clearing existing material data...');
    }
    
    // Process the input data
    const rows = inputData.split('\n');
    const processedData = [];
    let skippedRows = 0;
    
    Logger.log('Starting to process ' + (rows.length - 1) + ' rows of material data...');
    
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
          Logger.log('Processed row ' + i + ': ' + processedRow[0] + ' with ' + processedRow[1] + ' units to buy');
        } else {
          skippedRows++;
          Logger.log('Skipped row ' + i + ': ' + columns[0] + ' has 0 units to buy');
        }
      } else {
        skippedRows++;
        Logger.log('Skipped invalid row ' + i + ': insufficient columns');
      }
    }
    
    if (processedData.length > 0) {
      Logger.log('Updating sheet with processed data...');
      
      // Get the starting row for material data (after header)
      const startRow = materialRange.getRow() + 1;
      
      // Clear existing data and set new values
      materialRange.clearContent();
      sheet.getRange(startRow, 1, processedData.length, 3).setValues(processedData);
      
      Logger.log('Applying number formatting...');
      
      // Format numbers appropriately
      sheet.getRange(startRow, 2, processedData.length, 1).setNumberFormat('#,##0');  // To Buy
      sheet.getRange(startRow, 3, processedData.length, 1).setNumberFormat('#,##0.00');  // To Buy (Sell-Value)
      
      Logger.log('Material data import completed successfully');
      
      return {
        success: true,
        existingData: hasExistingData,
        rowsProcessed: processedData.length,
        skippedRows: skippedRows,
        details: {
          totalRows: rows.length - 1, // Subtract header row
          validRows: processedData.length,
          invalidRows: skippedRows,
          columnsProcessed: 6
        }
      };
    } else {
      Logger.log('Error: No valid data rows found');
      throw new Error('No valid data rows found');
    }
  }

  /**
   * Process job data and update the sheet
   * @param {string} inputData - Tab-separated job data
   * @param {string} sheetName - Name of the sheet to update
   * @param {string} jobType - Type of job being processed
   */
  static processJobData(inputData, sheetName, jobType) {
    // TODO: Implement job data processing
    // This will handle the different job types and their specific data formats
    // Will need to validate job data and update the appropriate ranges
  }
} 