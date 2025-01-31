function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Industry Manager')
    .addItem('Create New Project', 'createNewProject')
    .addSeparator()
    .addItem('Setup ESI Access', 'showESIAuthDialog')
    .addToUi();
}

function getNextCoreNumber() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  let maxCoreNumber = 0;
  
  sheets.forEach(sheet => {
    const name = sheet.getName();
    if (name.startsWith('CORE')) {
      const number = parseInt(name.replace('CORE', ''), 10);
      if (!isNaN(number) && number > maxCoreNumber) {
        maxCoreNumber = number;
      }
    }
  });
  
  return `CORE${maxCoreNumber + 1}`;
}

function createNewProject() {
  const ui = SpreadsheetApp.getUi();
  const nextCoreName = getNextCoreNumber();
  
  const html = HtmlService.createHtmlOutput(`
    <style>
      body {
        font-family: Roboto, Arial, sans-serif;
        margin: 0;
        padding: 16px;
      }
      .form-group {
        margin-bottom: 16px;
      }
      label {
        display: block;
        font-size: 13px;
        color: #5f6368;
        margin-bottom: 4px;
      }
      input {
        width: 100%;
        padding: 6px 8px;
        border: 1px solid #dadce0;
        border-radius: 4px;
        box-sizing: border-box;
        font-size: 14px;
        color: #202124;
      }
      input:focus {
        outline: none;
        border-color: #1a73e8;
      }
      input::placeholder {
        color: #80868b;
        font-size: 14px;
      }
      .buttons {
        text-align: right;
        margin-top: 16px;
      }
      button {
        font-family: 'Google Sans', Roboto, Arial, sans-serif;
        font-size: 14px;
        padding: 8px 24px;
        margin-left: 8px;
        border-radius: 4px;
        border: none;
        cursor: pointer;
      }
      .cancel {
        background: transparent;
        color: #1a73e8;
      }
      .cancel:hover {
        background: rgba(26,115,232,0.04);
      }
      .submit {
        background: #1a73e8;
        color: white;
      }
      .submit:hover {
        background: #1557b0;
        box-shadow: 0 1px 2px 0 rgba(66,133,244,0.3),
                    0 1px 3px 1px rgba(66,133,244,0.15);
      }
      .loading {
        display: none;
        text-align: center;
        padding: 20px 0;
      }
      .loading-spinner {
        border: 2px solid #f3f3f3;
        border-top: 2px solid #1a73e8;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
      }
      .loading-text {
        color: #5f6368;
        font-size: 14px;
        margin-bottom: 8px;
      }
      .loading-step {
        color: #80868b;
        font-size: 13px;
        margin: 4px 0;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
    <form id="projectForm" onsubmit="handleSubmit(event)">
      <div class="form-group">
        <label for="projectName">Project name</label>
        <input type="text" id="projectName" name="projectName" 
               placeholder="Enter custom name or leave empty for ${nextCoreName}">
      </div>
      <div class="form-group">
        <label for="ravworksLink">Ravworks link (optional)</label>
        <input type="text" id="ravworksLink" name="ravworksLink" 
               placeholder="e.g. https://ravworks.com/project/sWwMCuR">
      </div>
      <div class="buttons">
        <button type="button" class="cancel" onclick="google.script.host.close()">Cancel</button>
        <button type="submit" class="submit">OK</button>
      </div>
    </form>
    <div id="loading" class="loading">
      <div class="loading-spinner"></div>
      <div class="loading-text">Creating project...</div>
      <div id="loadingSteps">
        <div class="loading-step">• Creating project template</div>
        <div class="loading-step" id="ravworksStep" style="display: none">• Importing Ravworks data</div>
      </div>
    </div>
    <script>
      function showLoading(hasRavworks) {
        document.getElementById('projectForm').style.display = 'none';
        document.getElementById('loading').style.display = 'block';
        if (hasRavworks) {
          document.getElementById('ravworksStep').style.display = 'block';
        }
      }
      
      function handleSubmit(e) {
        e.preventDefault();
        const projectName = document.getElementById('projectName').value.trim();
        const ravworksLink = document.getElementById('ravworksLink').value.trim();
        showLoading(!!ravworksLink);
        google.script.run
          .withSuccessHandler(() => google.script.host.close())
          .handleProjectCreation(projectName, ravworksLink);
      }
    </script>
  `).setWidth(400).setHeight(220);
  
  ui.showModalDialog(html, 'Create New Project');
}

function handleProjectCreation(projectName, ravworksLink) {
  if (!projectName) {
    projectName = getNextCoreNumber();
  }
  
  const templateManager = new TemplateManager();
  templateManager.createNewProject(projectName);
  
  // Process Ravworks import if link was provided
  if (ravworksLink) {
    // Extract project ID from link if provided
    const projectId = ravworksLink.split('/').pop();
    if (projectId) {
      UserInputs.processRavworksImport(projectId);
    }
  }
}

function syncESIData() {
  const esiManager = new ESIManager();
  const jobManager = new JobManager(esiManager);
  const materialTracker = new MaterialTracker(esiManager);
  
  jobManager.pullESIJobs();
  materialTracker.syncInventory();
}

function updateMarketPrices() {
  const esiManager = new ESIManager();
  const marketManager = new MarketManager(esiManager);
  marketManager.updateCosts();
}

function checkIndustryJobs() {
  const esiManager = new ESIManager();
  const jobManager = new JobManager(esiManager);
  const jobSyncManager = new JobSyncManager(esiManager, jobManager);
  jobSyncManager.matchSheetEntries();
}

function showESIAuthDialog() {
  const ui = SpreadsheetApp.getUi();
  const esiManager = new ESIManager();
  const authUrl = esiManager.getAuthorizationUrl();
  
  const html = HtmlService.createTemplate(`
    <style>
      body { 
        font-family: Arial, sans-serif; 
        padding: 20px;
        text-align: center;
        margin: 0;
      }
      .header { 
        margin-bottom: 20px;
      }
      .header h2 {
        font-size: 22px;
        margin: 0 0 15px;
      }
      .instructions { 
        color: #444; 
        margin-bottom: 20px;
        line-height: 1.6;
        font-size: 15px;
      }
      .scopes { 
        background: #f5f5f5;
        padding: 15px;
        border-radius: 6px;
        margin: 20px 0;
        text-align: left;
        font-size: 14px;
      }
      .scope-item {
        margin-bottom: 10px;
        font-size: 14px;
      }
      .scope-item:last-child {
        margin-bottom: 0;
      }
      .auth-link {
        display: inline-block;
        padding: 10px;
        background: transparent;
        text-decoration: none;
        border-radius: 6px;
        margin-top: 15px;
      }
      .auth-link:hover img {
        transform: scale(1.03);
        transition: transform 0.2s ease;
      }
      .eve-sso-image {
        width: 250px;
        height: auto;
      }
    </style>
    <div class="instructions">
      To use industry management features, we need access to your EVE Online data through ESI.
      This will allow us to:
    </div>
    <div class="scopes">
      <div class="scope-item">✓ Read corporation structures</div>
      <div class="scope-item">✓ Read corporation roles</div>
      <div class="scope-item">✓ Read corporation assets</div>
      <div class="scope-item">✓ Read corporation industry jobs</div>
      <div class="scope-item">✓ Read corporation container logs</div>
    </div>
    <div class="instructions">
      Click below to log in with your EVE Online account
    </div>
    <a href="<?= authUrl ?>" target="_blank" class="auth-link" onclick="google.script.host.close()">
      <img src="https://web.ccpgamescdn.com/eveonlineassets/developers/eve-sso-login-black-large.png" 
           alt="Log in with EVE Online" 
           class="eve-sso-image">
    </a>
  `);
  
  html.authUrl = authUrl;
  
  const htmlOutput = html.evaluate()
    .setWidth(500)
    .setHeight(450)
    .setTitle('EVE Online ESI Authentication');
  
  ui.showModalDialog(htmlOutput, 'EVE Online ESI Authentication');
}

function handleAuthCallback(request) {
  const esiManager = new ESIManager();
  const result = esiManager.handleAuthCallback(request);
  
  return HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 20px; 
            text-align: center;
            max-width: 800px;
            margin: 0 auto;
            line-height: 1.6;
          }
          .icon { 
            font-size: 48px; 
            margin-bottom: 20px;
          }
          .status {
            margin-bottom: 30px;
            padding: 15px;
            border-radius: 4px;
          }
          .success { 
            background-color: #d4edda;
            color: #155724;
          }
          .error { 
            background-color: #f8d7da;
            color: #721c24;
            white-space: pre-wrap;
            text-align: left;
          }
          .close-instructions {
            color: #666;
            margin-top: 20px;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 4px;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="icon">${result.success ? '✓' : '❌'}</div>
        <div class="status ${result.success ? 'success' : 'error'}">
          ${result.success ? 'Authentication successful!' : 'Authentication failed:\\n\\n' + result.error}
        </div>
        ${result.success ? `
          <div class="close-instructions">
            You can now close this window and return to the spreadsheet.
          </div>
        ` : ''}
      </body>
    </html>
  `)
  .setTitle('EVE Online ESI Authentication')
  .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

function clearCache() {
  Utility.clearCache();
  SpreadsheetApp.getActiveSpreadsheet().toast('Cache cleared successfully');
}

/**
 * Debug function for testing Ravworks import
 * Run this function directly in the Apps Script debugger
 * @param {string} projectId - Optional project ID to test (defaults to example ID)
 * @returns {Object} Import result
 */
async function debugRavworksImport(projectId = 'sWwMCuR') {
  console.log('=== Starting Ravworks Import Debug ===');
  console.log(`Project ID: ${projectId}`);
  
  try {
    console.log('Calling processRavworksImport...');
    const result = await UserInputs.processRavworksImport(projectId);
    
    console.log('\n=== Import Result ===');
    console.log(JSON.stringify(result, null, 2));
    
    return result;
  } catch (error) {
    console.error('\n=== Import Error ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
} 