function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Industry Manager')
    .addItem('Create New Project', 'createNewProject')
    .addSeparator()
    .addSubMenu(ui.createMenu('Ravwork')
      .addItem('Input Materials', 'UserInputs.handleMaterialInput')
      .addSubMenu(ui.createMenu('Jobs')
        .addItem('Input Reaction', 'UserInputs.handleReactionJobInput')
      )
    )
    .addSeparator()
    .addItem('Setup ESI Access', 'showESIAuthDialog')
    .addToUi();
}

function createNewProject() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Create New Project', 'Enter project name:', ui.ButtonSet.OK_CANCEL);
  
  if (response.getSelectedButton() === ui.Button.OK) {
    let projectName = response.getResponseText().trim();
    
    if (!projectName) {
      // Find highest CORE number
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
      
      projectName = `CORE${maxCoreNumber + 1}`;
    }
    
    const templateManager = new TemplateManager();
    const newSheet = templateManager.createNewProject(projectName);
    newSheet.activate();
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