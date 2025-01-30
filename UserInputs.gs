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
        body { font-family: Arial, sans-serif; padding: 20px; }
        textarea { width: 100%; height: 300px; margin: 10px 0; font-family: monospace; }
        .header { margin-bottom: 10px; }
        .instructions { color: #666; margin-bottom: 15px; }
        button { padding: 8px 15px; cursor: pointer; margin-right: 10px; }
        #loading { display: none; color: #666; margin-top: 10px; }
        .spinner { display: inline-block; width: 20px; height: 20px; border: 3px solid #f3f3f3;
                  border-top: 3px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>
      <div class="header">
        <h3>Material Input</h3>
      </div>
      <div class="instructions">
        Paste your material data below in tab-separated format:<br>
        Name | To Buy | To Buy (Sell-Value) | To Buy Volume
      </div>
      <textarea id="materialData"></textarea>
      <div>
        <button onclick="submitData()" id="submitBtn">Import Materials</button>
        <button onclick="google.script.host.close()">Cancel</button>
      </div>
      <div id="loading">
        <div class="spinner"></div>
        <span>Processing materials...</span>
      </div>
      <script>
        function submitData() {
          const data = document.getElementById('materialData').value;
          if (!data.trim()) {
            alert('Please paste material data first');
            return;
          }
          
          // Show loading state
          document.getElementById('loading').style.display = 'block';
          document.getElementById('submitBtn').disabled = true;
          document.getElementById('materialData').disabled = true;
          
          google.script.run
            .withSuccessHandler(function() {
              // Show success message before closing
              alert('Materials have been imported successfully!');
              google.script.host.close();
            })
            .withFailureHandler(function(error) {
              // Reset UI state on error
              document.getElementById('loading').style.display = 'none';
              document.getElementById('submitBtn').disabled = false;
              document.getElementById('materialData').disabled = false;
              alert('Error: ' + error);
            })
            .processMaterialData(data);
        }
      </script>
    `)
      .setWidth(600)
      .setHeight(500);
    
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
   */
  static processMaterialData(inputData) {
    const sheet = SpreadsheetApp.getActiveSheet();
    
    if (!sheet) {
      throw new Error('No active sheet found');
    }
    
    const materialRange = sheet.getRange(CONFIG.RANGES.MATERIALS);
  
    if (!inputData) {
      throw new Error('No data provided');
    }
    
    // Process the input data
    const rows = inputData.split('\n');
    const processedData = rows.map(row => {
      const columns = row.split('\t');
      if (columns.length >= 4) {
        return [
          columns[0],  // Name
          parseFloat(columns[1]) || 0,  // To Buy
          parseFloat(columns[2].replace(/,/g, '')) || 0,  // To Buy (Sell-Value)
          parseFloat(columns[3]) || 0  // To Buy Volume
        ];
      }
      return null;
    }).filter(row => row !== null);
    
    if (processedData.length > 0) {
      // Clear existing data and set new values
      materialRange.clearContent();
      sheet.getRange(2, 1, processedData.length, 4).setValues(processedData);
      
      // Format numbers appropriately
      sheet.getRange(2, 2, processedData.length, 1).setNumberFormat('#,##0');  // To Buy
      sheet.getRange(2, 3, processedData.length, 1).setNumberFormat('#,##0.00');  // To Buy (Sell-Value)
      sheet.getRange(2, 4, processedData.length, 1).setNumberFormat('#,##0.00');  // To Buy Volume
      
      // Return true to indicate success (will be handled by client-side success handler)
      return true;
    } else {
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