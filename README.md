# PIC Industry Manager

A Google Apps Script-based industry management system for EVE Online corporations, designed to track and manage industrial projects, materials, and jobs efficiently and securely.

## Table of Contents
- [Features](#features)
- [Getting Started](#getting-started)
- [Usage Guide](#usage-guide)
- [Project Structure](#project-structure)
- [Fee Structure](#fee-structure)
- [Contributing](#contributing)
- [Security](#security)
- [Support](#support)
- [License](#license)

## Features

### Project Management
- Create and manage multiple industrial projects from templates
- Automatic project naming convention (CORE1, CORE2, etc.)
- Comprehensive project dashboard for overview and analytics
- Real-time progress tracking and status updates

### ESI Integration
- Secure EVE Online SSO authentication
- Real-time data synchronization with EVE servers
- Automated job tracking and monitoring
- Asset and material inventory synchronization
- Corporation structure integration

### Material Management
- Streamlined material input through the Ravwork menu
- Support for tab-separated data import
- Automatic market price updates and tracking
- Comprehensive material usage and inventory monitoring
- Real-time stock level alerts

### Job Management
- Support for multiple industrial activities:
  - Blueprint Original/Copy (BPO/BPC) Management
  - Reaction Processing
  - Component Manufacturing
  - Final Product Assembly
- Automated fee calculations and tracking
- Real-time job status monitoring
- ESI-based job synchronization
- Efficiency tracking and optimization

## Getting Started

### Prerequisites
- Google Workspace account with Spreadsheet access
- EVE Online account with required roles:
  - Director or Factory Manager permissions
- ESI Scopes (required):
  - `esi-corporations.read_structures.v1`
  - `esi-characters.read_corporation_roles.v1`
  - `esi-assets.read_corporation_assets.v1`
  - `esi-industry.read_corporation_jobs.v1`
  - `esi-corporations.read_container_logs.v1`

### Installation
1. Access the Google Spreadsheet template
2. Navigate to the "Industry Manager" menu
3. Select "Setup ESI Access"
4. Complete the EVE SSO authentication process
5. Initialize your first project using "Create New Project"

## Usage Guide

### Project Creation
1. Access "Industry Manager" > "Create New Project"
2. Enter project name (optional - system will auto-generate if left blank)
3. System will generate a new project sheet from the template
4. Configure project-specific settings as needed

### Material Management
1. Navigate to "Industry Manager" > "Ravwork" > "Input Materials"
2. Input material data using the tab-separated format:
   ```
   Name | To Buy | To Buy (Sell-Value) | To Buy Volume
   ```
3. Select "Import Materials" to process the data
4. Review and confirm material allocations

### Job Management
1. Access "Industry Manager" > "Ravwork" > "Jobs"
2. Select the appropriate job category
3. Input job specifications following the template format
4. Monitor job progress through ESI synchronization

## Fee Structure

### Daily Fees
- Location Fee: 1,000,000 ISK per day

### Manufacturing Rates
#### T1 Production
- Components: 250 ISK/run
- Modules: 10,000 ISK/run
- Ships: 100,000 ISK/run
- Capital Ships: 25,000 ISK/run

#### T2 Production
- Modules: 100,000 ISK/run
- Ships: 2,500,000 ISK/run
- Capital Ships: 125,000 ISK/run

## Project Structure

### Core Components
- `ESIManager`: EVE Online API integration handler
- `JobManager`: Industrial job management system
- `MaterialTracker`: Asset and material tracking
- `MarketManager`: Price management and updates
- `TemplateManager`: Project template system
- `UserInputs`: Input processing and validation
- `ContributorManager`: Contributor tracking
- `RewardCalculator`: Fee and reward computation

### Spreadsheet Organization
- Dashboard: Central project overview and metrics
- BPC/BPO: Blueprint management interface
- Reactions: Reaction job tracking system
- Components: Component production management
- Products: Final product assembly tracking
- Materials: Material inventory and management

## Security

### Data Protection
- Secure ESI token storage and management
- Role-based access control via EVE Online permissions
- Input validation and sanitization
- Regular security audits and updates
- Encrypted data transmission

### Access Control
- Restricted access based on EVE Online roles
- Multi-level permission system
- Activity logging and monitoring
- Regular access reviews

## Support

### Getting Help
1. Consult the project documentation
2. Contact system administrators
3. Submit detailed bug reports
4. Join the support channel

### Troubleshooting
- Check ESI token status
- Verify role permissions
- Review error logs
- Validate input data format

## License
This project is proprietary and confidential.
All rights reserved.

---
Last updated: 2024 