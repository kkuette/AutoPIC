# PIC Industry Manager

A Google Apps Script-based industry management system for EVE Online corporations, designed to track and manage industrial projects, materials, and jobs.

## Features

### Project Management
- Create new project sheets from a template
- Track multiple industrial projects simultaneously
- Automatic project naming (CORE1, CORE2, etc.)
- Comprehensive project dashboard

### ESI Integration
- Secure authentication with EVE SSO
- Real-time data synchronization
- Automatic job tracking
- Asset and material monitoring

### Material Management
- Easy material input through the Ravwork menu
- Tab-separated data import support
- Automatic price updates
- Material usage tracking
- Inventory synchronization

### Job Management
- Multiple job categories:
  - BPC/BPO Management
  - Reactions
  - Components
  - Final Products
- Automatic fee calculation
- Job status tracking
- ESI job synchronization

### Fee Structure
- Daily Location Fee: 1,000,000 ISK
- Run Rates:
  - T1 Components: 250 ISK/run
  - T1 Modules: 10,000 ISK/run
  - T1 Ships: 100,000 ISK/run
  - T2 Modules: 100,000 ISK/run
  - T2 Ships: 2,500,000 ISK/run
  - Capital T1: 25,000 ISK/run
  - Capital T2: 125,000 ISK/run

## Getting Started

### Prerequisites
- Google Spreadsheet access
- EVE Online account with required roles:
  - Director or Factory Manager
- Required ESI Scopes:
  - esi-corporations.read_structures.v1
  - esi-characters.read_corporation_roles.v1
  - esi-assets.read_corporation_assets.v1
  - esi-industry.read_corporation_jobs.v1
  - esi-corporations.read_container_logs.v1

### Setup
1. Open the spreadsheet
2. Go to "Industry Manager" menu
3. Click "Setup ESI Access"
4. Complete EVE SSO authentication
5. Create your first project using "Create New Project"

### Using the System

#### Creating a New Project
1. Click "Industry Manager" > "Create New Project"
2. Enter a project name or leave blank for auto-naming
3. A new project sheet will be created from the template

#### Adding Materials
1. Click "Industry Manager" > "Ravwork" > "Input Materials"
2. Paste your material data in tab-separated format:
   ```
   Name | To Buy | To Buy (Sell-Value) | To Buy Volume
   ```
3. Click "Import Materials" to process the data

#### Managing Jobs
1. Navigate to "Industry Manager" > "Ravwork" > "Jobs"
2. Select the appropriate job type
3. Enter job details according to the template format
4. Jobs will be automatically synchronized with ESI

## Project Structure

### Core Classes
- `ESIManager`: Handles EVE Online API integration
- `JobManager`: Manages industrial jobs
- `MaterialTracker`: Tracks materials and assets
- `MarketManager`: Handles market prices and updates
- `TemplateManager`: Manages project templates and creation
- `UserInputs`: Handles user input processing
- `ContributorManager`: Manages contributor activities
- `RewardCalculator`: Calculates fees and rewards

### Sheet Structure
- Dashboard: Project overview and statistics
- BPC/BPO: Blueprint management
- Reactions: Reaction job tracking
- Components: Component production
- Products: Final product assembly
- Materials: Material tracking and management

## Contributing

### Required Roles
- Director or Factory Manager role in corporation
- Appropriate ESI scopes authorized
- Access to corporation assets and structures

### Material Input Format
Materials should be provided in tab-separated format with the following columns:
```
Name | To Buy | To Buy (Sell-Value) | To Buy Volume
```

## Support
For issues or questions:
1. Check the project documentation
2. Contact project administrators
3. Submit bug reports with detailed information

## Security
- ESI tokens are stored securely
- Access is restricted by EVE Online roles
- All data is validated before processing
- Regular security audits are performed

## License
This project is proprietary and confidential.
All rights reserved. 