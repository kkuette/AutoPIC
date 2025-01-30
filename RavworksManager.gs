class RavworksManager {
  /**
   * Retrieves and parses a Ravworks industry project
   * @param {string} projectId - The project ID from the URL (e.g., 'sWwMCuR')
   * @returns {Promise<Object>} Parsed project data
   */
  static async getProject(projectId) {
    Logger.log(`[RavworksManager] Starting to fetch project with ID: ${projectId}`);
    try {
      const url = `https://www.ravworks.com/plan/${projectId}`;
      Logger.log(`[RavworksManager] Fetching data from URL: ${url}`);
      const response = UrlFetchApp.fetch(url);
      const html = response.getContentText();
      
      Logger.log(`[RavworksManager] Successfully fetched project data. Content length: ${html.length}`);
      return this.parseProjectHtml(html);
    } catch (error) {
      Logger.log(`[RavworksManager] Error fetching Ravworks project: ${error}`);
      throw new Error(`Failed to fetch Ravworks project: ${error.message}`);
    }
  }

  /**
   * Parses the HTML content of a Ravworks project page
   * @param {string} html - The HTML content of the project page
   * @returns {Object} Parsed project data
   */
  static parseProjectHtml(html) {
    Logger.log('[RavworksManager] Starting to parse project HTML');
    
    const projectData = {
      materials: [],
      jobs: {
        productionJobs: [],
        others: []
      }
    };

    try {
      // Parse materials from the embedded data
      Logger.log('[RavworksManager] Looking for materials in stocks table...');
      
      // Look for the stocks table content
      const stocksMatch = html.match(/id="stocks_table"[^>]*>([\s\S]*?)<\/table>/i);
      if (!stocksMatch) {
        Logger.log('[RavworksManager] No stocks table found in HTML');
        return projectData;
      }
      
      // Extract the table content
      const tableContent = stocksMatch[1];
      Logger.log(`[RavworksManager] Found table content, length: ${tableContent.length}`);
      Logger.log(`[RavworksManager] Table content sample: ${tableContent.substring(0, 200)}...`);
      
      // Parse table rows
      const rowMatches = tableContent.match(/<tr[^>]*>[\s\S]*?<\/tr>/g);
      if (!rowMatches) {
        Logger.log('[RavworksManager] No table rows found in content');
        return projectData;
      }
      
      Logger.log(`[RavworksManager] Found ${rowMatches.length} rows to process`);
      
      // Process each row
      rowMatches.forEach((row, index) => {
        // Skip header row
        if (row.includes('<th')) {
          Logger.log(`[RavworksManager] Skipping header row [${index + 1}]`);
          return;
        }
        
        // Extract cells using a more precise regex that includes nested content
        const cellMatches = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g);
        if (!cellMatches) {
          Logger.log(`[RavworksManager] No cells found in row [${index + 1}]`);
          return;
        }
        
        // Clean and extract cell contents
        const cells = cellMatches.map(cell => {
          // First extract any text content from a span with class "text-left"
          const nameMatch = cell.match(/<span[^>]*class="[^"]*text-left[^"]*"[^>]*>([\s\S]*?)<\/span>/);
          if (nameMatch) {
            return nameMatch[1].trim();
          }
          
          // Then try to extract any numeric content
          const numericMatch = cell.match(/>([\d,\.]+)</);
          if (numericMatch) {
            return numericMatch[1].trim();
          }
          
          // Finally, fall back to cleaning the entire cell content
          return cell
            .replace(/<td[^>]*>/, '')  // Remove opening td tag
            .replace(/<\/td>$/, '')    // Remove closing td tag
            .replace(/<[^>]+>/g, '')   // Remove any remaining HTML tags
            .replace(/&nbsp;/g, ' ')   // Replace HTML entities
            .trim();
        });
        
        // Log the raw cells for debugging
        Logger.log(`[RavworksManager] Raw cells for row [${index + 1}]: ${JSON.stringify(cells)}`);
        
        if (cells.length >= 6) {
          const material = {
            name: cells[1],
            toBuy: parseFloat(cells[2].replace(/,/g, '')) || 0,
            toBuyValue: parseFloat(cells[3].replace(/,/g, '')) || 0,
            toBuyVolume: parseFloat(cells[4].replace(/,/g, '')) || 0,
            startAmount: parseFloat(cells[5].replace(/,/g, '')) || 0,
            endAmount: parseFloat(cells[6].replace(/,/g, '')) || 0
          };

          // Only add materials that need to be bought and have a valid name
          if (material.toBuy > 0 && material.name) {
            projectData.materials.push(material);
            Logger.log(`[RavworksManager] Processed material [${index + 1}/${rowMatches.length}]: ${material.name} (${material.toBuy} units)`);
          } else {
            Logger.log(`[RavworksManager] Skipped material: ${material.name || 'unnamed'} (no units to buy or invalid name)`);
          }
        } else {
          Logger.log(`[RavworksManager] Skipped invalid row [${index + 1}]: insufficient cells (${cells.length})`);
        }
      });
      
      Logger.log(`[RavworksManager] Found ${projectData.materials.length} materials to buy`);

      // Parse jobs from accordion cards
      Logger.log('[RavworksManager] Starting to parse jobs from accordion cards...');
      
      // Find all cards directly in the HTML
      const cardMatches = html.match(/<div class="card">\s*<a class="card-link" data-toggle="collapse" href="#[^"]+">\s*<div class="card-header">\s*<div class="d-flex">\s*<div class="mr-auto"[^>]*>\s*<span>([^<]+)<\/span>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/a>[\s\S]*?<div[^>]*class="collapse"[\s\S]*?<\/div>\s*<\/div>/g);
      if (!cardMatches) {
        Logger.log('[RavworksManager] No job cards found in HTML');
        return projectData;
      }
      
      Logger.log(`[RavworksManager] Found ${cardMatches.length} job cards to process`);
      
      // Process each card
      cardMatches.forEach((card, cardIndex) => {
        // Extract card header to determine job type
        const headerMatch = card.match(/<div class="mr-auto"[^>]*>\s*<span>([^<]+)<\/span>/);
        if (!headerMatch) {
          Logger.log(`[RavworksManager] No header found in card [${cardIndex + 1}]`);
          return;
        }
        
        // Extract job category from header
        const category = headerMatch[1].trim();
        Logger.log(`[RavworksManager] Processing jobs for category: ${category}`);
        
        // Find the table in the card content
        const tableMatch = card.match(/<table[^>]*class="table[^"]*"[^>]*>([\s\S]*?)<\/table>/);
        if (!tableMatch) {
          Logger.log(`[RavworksManager] No table found in card [${cardIndex + 1}]`);
          return;
        }
        
        // Parse table rows
        const rowMatches = tableMatch[1].match(/<tr[^>]*>[\s\S]*?<\/tr>/g);
        if (!rowMatches) {
          Logger.log(`[RavworksManager] No rows found in table for card [${cardIndex + 1}]`);
          return;
        }
        
        Logger.log(`[RavworksManager] Found ${rowMatches.length} rows in table for card [${cardIndex + 1}]`);
        
        // Map category to job type - combine components and reactions
        const jobType = category.toLowerCase().includes('reactions') || category.toLowerCase().includes('components') 
          ? 'productionJobs'
          : 'others';
        
        // Initialize job type array if needed
        if (!projectData.jobs[jobType]) {
          projectData.jobs[jobType] = [];
        }
        
        // Process each row
        rowMatches.forEach((row, rowIndex) => {
          // Skip header row
          if (row.includes('<th')) {
            return;
          }
          
          // Extract cells
          const cellMatches = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g);
          if (!cellMatches) {
            Logger.log(`[RavworksManager] No cells found in row [${rowIndex + 1}] of table for card [${cardIndex + 1}]`);
            return;
          }
          
          // Clean and extract cell contents
          const cells = cellMatches.map(cell => {
            return cell
              .replace(/<td[^>]*>/, '')
              .replace(/<\/td>$/, '')
              .replace(/<[^>]+>/g, '')
              .replace(/&nbsp;/g, ' ')
              .trim();
          });
          
          if (cells.length >= 5) { // First cell is just an icon
            const job = {
              category,
              name: cells[1],
              runs: parseInt(cells[2]) || 0,
              days: parseFloat(cells[3]) || 0,
              jobCost: parseFloat(cells[4].replace(/,/g, '')) || 0
            };
            
            if (job.name && job.runs > 0) {
              projectData.jobs[jobType].push(job);
              Logger.log(`[RavworksManager] Processed ${category} job: ${job.name} (${job.runs} runs, ${job.days} days, ${job.jobCost} ISK)`);
            }
          }
        });
      });

      // Log job summary
      Object.entries(projectData.jobs).forEach(([type, jobs]) => {
        Logger.log(`[RavworksManager] ${type}: ${jobs.length} jobs`);
        Logger.log(`[RavworksManager] Total runs: ${jobs.reduce((sum, job) => sum + job.runs, 0)}`);
        Logger.log(`[RavworksManager] Total cost: ${jobs.reduce((sum, job) => sum + job.jobCost, 0)} ISK`);
        Logger.log(`[RavworksManager] Max days: ${Math.max(...jobs.map(job => job.days))} days`);
      });

      Logger.log('[RavworksManager] Successfully parsed all project data');
      
      // Group jobs by category for detailed breakdown
      const jobsByCategory = {};
      Object.entries(projectData.jobs).forEach(([type, jobs]) => {
        jobs.forEach(job => {
          if (!jobsByCategory[job.category]) {
            jobsByCategory[job.category] = {
              type,
              jobs: [],
              count: 0,
              totalRuns: 0,
              totalCost: 0,
              maxDays: 0
            };
          }
          jobsByCategory[job.category].jobs.push(job);
          jobsByCategory[job.category].count++;
          jobsByCategory[job.category].totalRuns += job.runs;
          jobsByCategory[job.category].totalCost += job.jobCost;
          jobsByCategory[job.category].maxDays = Math.max(jobsByCategory[job.category].maxDays, job.days);
        });
      });

      return {
        success: true,
        details: {
          materials: projectData.materials.length,
          jobs: Object.entries(projectData.jobs).reduce((details, [type, jobs]) => {
            details[type] = {
              count: jobs.length,
              totalRuns: jobs.reduce((sum, job) => sum + job.runs, 0),
              totalCost: jobs.reduce((sum, job) => sum + job.jobCost, 0),
              maxDays: Math.max(...jobs.map(job => job.days)),
              categories: Object.entries(jobsByCategory)
                .filter(([_, data]) => data.type === type)
                .reduce((cats, [category, data]) => {
                  cats[category] = {
                    count: data.count,
                    totalRuns: data.totalRuns,
                    totalCost: data.totalCost,
                    maxDays: data.maxDays
                  };
                  return cats;
                }, {})
            };
            return details;
          }, {})
        },
        data: projectData  // Include the full project data
      };
    } catch (error) {
      Logger.log(`[RavworksManager] Error parsing Ravworks HTML: ${error}`);
      throw new Error(`Failed to parse Ravworks project: ${error.message}`);
    }
  }

  /**
   * Extracts the project ID from a Ravworks URL
   * @param {string} url - The Ravworks project URL
   * @returns {string} The project ID
   */
  static getProjectIdFromUrl(url) {
    Logger.log(`[RavworksManager] Extracting project ID from URL: ${url}`);
    try {
      const match = url.match(/\/plan\/([^\/]+)$/);
      if (!match) {
        Logger.log('[RavworksManager] Failed to extract project ID: Invalid URL format');
        throw new Error('Invalid Ravworks URL format');
      }
      Logger.log(`[RavworksManager] Successfully extracted project ID: ${match[1]}`);
      return match[1];
    } catch (error) {
      Logger.log(`[RavworksManager] Error extracting project ID: ${error}`);
      throw new Error(`Failed to extract project ID: ${error.message}`);
    }
  }
} 