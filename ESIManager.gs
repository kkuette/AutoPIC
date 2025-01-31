/**
 * Manager class for EVE ESI API interactions
 */
class ESIManager {
  constructor() {
    this.baseUrl = 'https://esi.evetech.net/latest';
    this.clientId = PropertiesService.getScriptProperties().getProperty('ESI_CLIENT_ID');
    this.clientSecret = PropertiesService.getScriptProperties().getProperty('ESI_CLIENT_SECRET');
    this.callbackUrl = PropertiesService.getScriptProperties().getProperty('ESI_CALLBACK_URL');
  }
  
  getAuthorizationUrl() {
    const oauth2Service = this.getOAuth2Service();
    return oauth2Service.getAuthorizationUrl();
  }
  
  handleAuthCallback(request) {
    const oauth2Service = this.getOAuth2Service();
    let success = false;
    let error = '';
    
    try {
      const isAuthorized = oauth2Service.handleCallback(request);
      
      if (!isAuthorized) {
        throw new Error('Authorization failed. Please try again.');
      }
      
      // Store character and corporation IDs for future use
      const token = oauth2Service.getAccessToken();
      
      // Use the correct EVE SSO verify endpoint
      const verifyUrl = 'https://esi.evetech.net/verify/';
      const response = UrlFetchApp.fetch(verifyUrl, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      const verify = JSON.parse(response.getContentText());
      
      if (!verify || typeof verify !== 'object') {
        throw new Error('Invalid verify response');
      }
      
      // Handle both v1 and v2 verify response formats
      const characterInfo = {
        character_id: verify.CharacterID || verify.character_id,
        character_name: verify.CharacterName || verify.name,
        corporation_id: verify.CharacterCorporationID || verify.corporation_id
      };
      
      // Check if character has a corporation
      if (!characterInfo.corporation_id) {
        // If no corporation_id, try to fetch character info from ESI
        const characterEndpoint = `characters/${characterInfo.character_id}/`;
        
        const options = {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          muteHttpExceptions: true
        };
        
        const charResponse = UrlFetchApp.fetch(this.baseUrl + '/' + characterEndpoint, options);
        const responseCode = charResponse.getResponseCode();
        
        if (responseCode === 404) {
          throw new Error('Character not found in EVE Online. Please ensure you are using a valid character.');
        }
        
        if (responseCode !== 200) {
          throw new Error('Failed to fetch character data from ESI. Please try again later.');
        }
        
        const charData = JSON.parse(charResponse.getContentText());
        
        if (charData && charData.corporation_id) {
          characterInfo.corporation_id = charData.corporation_id;
        } else {
          throw new Error('Character must be a member of a corporation to use this application.');
        }
      }
      
      // Store character and corporation info
      const properties = {
        CHARACTER_ID: characterInfo.character_id.toString(),
        CHARACTER_NAME: characterInfo.character_name,
        CORPORATION_ID: characterInfo.corporation_id.toString()
      };
      
      PropertiesService.getScriptProperties().setProperties(properties);
      
      // Verify character has required roles
      const roleCheck = this.verifyCharacterRoles();
      
      if (!roleCheck.hasRequiredRoles) {
        throw new Error('Character does not have the required corporation roles.\n' +
          'Required roles: ' + roleCheck.requiredRoles.join(' or ') + '\n' +
          'Current roles: ' + (roleCheck.currentRoles.length > 0 ? roleCheck.currentRoles.join(', ') : 'None'));
      }
      
      success = true;
    } catch (error) {
      error = error.message;
    }
    
    return {
      success: success,
      error: error
    };
  }
  
  verifyCharacterRoles() {
    try {
      const oauth2Service = this.getOAuth2Service();
      const token = oauth2Service.getAccessToken();
      const characterId = PropertiesService.getScriptProperties().getProperty('CHARACTER_ID');
      
      if (!characterId) {
        return {
          hasRequiredRoles: false,
          currentRoles: [],
          error: 'Character ID not found. Please authenticate first.'
        };
      }
      
      // Fetch character roles with proper authorization
      const rolesEndpoint = `characters/${characterId}/roles/`;
      const url = this.baseUrl + '/' + rolesEndpoint;
      
      const options = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        muteHttpExceptions: true
      };
      
      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();
      
      if (responseCode !== 200) {
        return {
          hasRequiredRoles: false,
          currentRoles: [],
          error: `Failed to fetch roles. Response code: ${responseCode}, Response: ${responseText}`
        };
      }
      
      const rolesData = JSON.parse(responseText);
      
      // Check for required roles (Director or Factory_Manager)
      const requiredRoles = ['Director', 'Factory_Manager'];
      const currentRoles = rolesData.roles || [];
      const hasRequiredRole = currentRoles.some(role => requiredRoles.includes(role));
      
      return {
        hasRequiredRoles: hasRequiredRole,
        currentRoles: currentRoles,
        requiredRoles: requiredRoles
      };
    } catch (error) {
      return {
        hasRequiredRoles: false,
        currentRoles: [],
        error: error.message
      };
    }
  }
  
  getOAuth2Service() {
    return OAuth2.createService('EVE Online')
      .setAuthorizationBaseUrl('https://login.eveonline.com/v2/oauth/authorize')
      .setTokenUrl('https://login.eveonline.com/v2/oauth/token')
      .setClientId(CONFIG.ESI.CLIENT_ID)
      .setClientSecret(CONFIG.ESI.CLIENT_SECRET)
      .setCallbackFunction('handleAuthCallback')
      .setPropertyStore(PropertiesService.getUserProperties())
      .setScope(CONFIG.ESI.SCOPES.join(' '))
      .setParam('response_type', 'code')
      .setRedirectUri(CONFIG.ESI.CALLBACK_URL);
  }
  
  async fetchESIData(endpoint, params = {}) {
    const oauth2Service = this.getOAuth2Service();
    if (!oauth2Service.hasAccess()) {
      throw new Error('Authentication required');
    }
    
    const token = oauth2Service.getAccessToken();
    let url = `${this.baseUrl}${endpoint}`;
    
    // Replace path parameters
    if (endpoint.includes('{corporation_id}')) {
      const corpId = PropertiesService.getScriptProperties().getProperty('CORPORATION_ID');
      if (!corpId) throw new Error('Corporation ID not found. Please authenticate first.');
      url = url.replace('{corporation_id}', corpId);
    }
    
    const options = {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    return this.parseResponse(response);
  }
  
  parseResponse(response) {
    const code = response.getResponseCode();
    const content = response.getContentText();
    
    if (code >= 200 && code < 300) {
      return JSON.parse(content);
    }
    
    throw new Error(`ESI Error: ${code} - ${content}`);
  }

  /**
   * Fetches corporation structures
   * Requires scope: esi-corporations.read_structures.v1
   */
  async getCorporationStructures(corporationId) {
    const endpoint = `corporations/${corporationId}/structures/`;
    const url = `${this.baseUrl}/${endpoint}`;
    const oauth2Service = this.getOAuth2Service();
    const token = oauth2Service.getAccessToken();

    const response = UrlFetchApp.fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode !== 200) {
      throw new Error(`Failed to fetch corporation structures. Response code: ${responseCode}, Response: ${responseText}`);
    }

    return JSON.parse(responseText);
  }

  /**
   * Fetches character's corporation roles
   * Requires scope: esi-characters.read_corporation_roles.v1
   */
  async getCharacterRoles(characterId) {
    const endpoint = `characters/${characterId}/roles/`;
    const url = `${this.baseUrl}/${endpoint}`;
    const oauth2Service = this.getOAuth2Service();
    const token = oauth2Service.getAccessToken();

    const response = UrlFetchApp.fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode !== 200) {
      throw new Error(`Failed to fetch character roles. Response code: ${responseCode}, Response: ${responseText}`);
    }

    return JSON.parse(responseText);
  }

  /**
   * Fetches corporation assets
   * Requires scope: esi-assets.read_corporation_assets.v1
   */
  async getCorporationAssets(corporationId) {
    const endpoint = `corporations/${corporationId}/assets/`;
    const url = `${this.baseUrl}/${endpoint}`;
    const oauth2Service = this.getOAuth2Service();
    const token = oauth2Service.getAccessToken();

    const response = UrlFetchApp.fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode !== 200) {
      throw new Error(`Failed to fetch corporation assets. Response code: ${responseCode}, Response: ${responseText}`);
    }

    return JSON.parse(responseText);
  }

  /**
   * Fetches corporation industry jobs
   * Requires scope: esi-industry.read_corporation_jobs.v1
   */
  async getCorporationIndustryJobs(corporationId) {
    const endpoint = `corporations/${corporationId}/industry/jobs/`;
    const url = `${this.baseUrl}/${endpoint}`;
    const oauth2Service = this.getOAuth2Service();
    const token = oauth2Service.getAccessToken();

    const response = UrlFetchApp.fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode !== 200) {
      throw new Error(`Failed to fetch corporation industry jobs. Response code: ${responseCode}, Response: ${responseText}`);
    }

    return JSON.parse(responseText);
  }

  /**
   * Fetches corporation container logs
   * Requires scope: esi-corporations.read_container_logs.v1
   */
  async getCorporationContainerLogs(corporationId) {
    const endpoint = `corporations/${corporationId}/containers/logs/`;
    const url = `${this.baseUrl}/${endpoint}`;
    const oauth2Service = this.getOAuth2Service();
    const token = oauth2Service.getAccessToken();

    const response = UrlFetchApp.fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode !== 200) {
      throw new Error(`Failed to fetch container logs. Response code: ${responseCode}, Response: ${responseText}`);
    }

    return JSON.parse(responseText);
  }

  // Helper method to handle paginated responses
  async getAllPages(url) {
    const oauth2Service = this.getOAuth2Service();
    const token = oauth2Service.getAccessToken();
    let page = 1;
    let allData = [];
    
    while (true) {
      const response = UrlFetchApp.fetch(`${url}?page=${page}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        muteHttpExceptions: true
      });
      
      const responseCode = response.getResponseCode();
      if (responseCode !== 200) {
        throw new Error(`Failed to fetch page ${page}. Response code: ${responseCode}`);
      }
      
      const data = JSON.parse(response.getContentText());
      if (!data.length) {
        break;
      }
      
      allData = allData.concat(data);
      page++;
    }
    
    return allData;
  }

  /**
   * Get cached value with expiration check
   * @private
   * @param {string} key - Cache key
   * @returns {any} Cached value or null if expired/not found
   */
  static getCachedValue(key) {
    const cache = CacheService.getScriptCache();
    const data = cache.get(key);
    if (!data) return null;
    
    try {
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  }

  /**
   * Set cached value with expiration
   * @private
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} expirationInSeconds - Cache expiration time in seconds
   */
  static setCachedValue(key, value, expirationInSeconds = 3600) {
    const cache = CacheService.getScriptCache();
    cache.put(key, JSON.stringify(value), expirationInSeconds);
  }

  /**
   * Get blueprint information from SDE for multiple type IDs
   * @private
   * @param {number[]} typeIds - Array of type IDs to look up
   * @returns {Promise<Map<number, Object>>} Map of typeId to blueprint info
   */
  static async getBlueprintFromSDE(typeIds) {
    try {
      // Ensure we have an array of typeIds
      const ids = Array.isArray(typeIds) ? typeIds : [typeIds];
      Logger.log(`[ESIManager] Fetching blueprint data for ${ids.length} type IDs`);
      
      // Fetch blueprints data from hoboleaks
      Logger.log('[ESIManager] Requesting blueprint data from hoboleaks SDE...');
      const response = await UrlFetchApp.fetch('https://sde.hoboleaks.space/tq/blueprints.json', {
        muteHttpExceptions: true
      });

      if (response.getResponseCode() !== 200) {
        Logger.log(`[ESIManager] SDE request failed: ${response.getResponseCode()} - ${response.getContentText()}`);
        return new Map();
      }

      const blueprintsData = JSON.parse(response.getContentText());
      Logger.log(`[ESIManager] Retrieved ${Object.keys(blueprintsData).length} blueprints from SDE`);
      
      const result = new Map();

      // Create a map of product typeId to blueprint info for quick lookup
      const productToBlueprint = new Map();
      let manufacturingBlueprintCount = 0;
      
      for (const [blueprintId, data] of Object.entries(blueprintsData)) {
        const productTypeId = data.activities?.manufacturing?.products?.[0]?.typeID;
        if (productTypeId) {
          manufacturingBlueprintCount++;
          productToBlueprint.set(productTypeId, {
            blueprintTypeID: parseInt(blueprintId),
            maxProductionLimit: data.maxProductionLimit,
            copyingTime: data.activities?.copying?.time || 0
          });
        }
      }
      Logger.log(`[ESIManager] Found ${manufacturingBlueprintCount} manufacturing blueprints in SDE`);

      // Process each typeId
      let directMatches = 0;
      let productMatches = 0;
      
      ids.forEach(typeId => {
        // First check if it's a blueprint
        if (blueprintsData[typeId]) {
          directMatches++;
          result.set(typeId, {
            blueprintTypeID: parseInt(typeId),
            maxProductionLimit: blueprintsData[typeId].maxProductionLimit,
            copyingTime: blueprintsData[typeId].activities?.copying?.time || 0
          });
          return;
        }

        // Then check if it's a product
        const productInfo = productToBlueprint.get(typeId);
        if (productInfo) {
          productMatches++;
          result.set(typeId, productInfo);
        }
      });

      Logger.log(`[ESIManager] Blueprint matches - Direct: ${directMatches}, Product: ${productMatches}, Total: ${result.size}/${ids.length}`);
      return result;
    } catch (error) {
      Logger.log(`[ESIManager] Error fetching blueprints data: ${error}`);
      if (error.stack) {
        Logger.log(`[ESIManager] Stack trace: ${error.stack}`);
      }
      return new Map();
    }
  }

  /**
   * Get blueprint information by item name
   * @param {string} itemName - Name of the item to find blueprint for
   * @returns {Promise<Object>} Blueprint information
   */
  static async getBlueprintByName(itemName) {
    try {
      const blueprintMap = await this.getBlueprintsByNames([itemName]);
      return blueprintMap.get(itemName) || null;
    } catch (error) {
      Logger.log(`[ESIManager] Error getting blueprint for ${itemName}: ${error}`);
      throw error;
    }
  }

  /**
   * Get blueprint information for multiple items at once
   * @param {string[]} itemNames - Array of item names to look up
   * @returns {Promise<Map<string, Object>>} Map of item name to blueprint info
   */
  static async getBlueprintsByNames(itemNames) {
    try {
      Logger.log(`[ESIManager] Starting blueprint resolution for ${itemNames.length} items`);
      
      // Remove duplicates and empty names while preserving case for display
      const uniqueNamesMap = new Map();
      itemNames.forEach(name => {
        if (name && name.trim()) {
          uniqueNamesMap.set(name.toLowerCase(), name);
        }
      });
      const uniqueNames = Array.from(uniqueNamesMap.values());
      Logger.log(`[ESIManager] After deduplication: ${uniqueNames.length} unique names`);

      if (uniqueNames.length === 0) {
        Logger.log('[ESIManager] No valid names to process');
        return new Map();
      }

      // Get type IDs for all unique names
      Logger.log('[ESIManager] Resolving type IDs...');
      const typeIds = await this.resolveTypeIds(uniqueNames);
      Logger.log(`[ESIManager] Resolved ${typeIds.size} type IDs out of ${uniqueNames.length} names`);
      
      // Get all blueprint info at once
      const typeIdArray = Array.from(typeIds.values());
      Logger.log(`[ESIManager] Fetching blueprint info for ${typeIdArray.length} type IDs`);
      const blueprintInfoMap = await this.getBlueprintFromSDE(typeIdArray);
      Logger.log(`[ESIManager] Found blueprint info for ${blueprintInfoMap.size} types`);

      const result = new Map();
      let matchCount = 0;

      // Process each item
      uniqueNames.forEach((name) => {
        const typeId = typeIds.get(name.toLowerCase());
        if (!typeId) {
          Logger.log(`[ESIManager] No type ID found for: ${name}`);
          return;
        }

        const blueprintInfo = blueprintInfoMap.get(typeId);
        if (blueprintInfo) {
          matchCount++;
          result.set(name, {
            id: typeId,
            name: name,
            maxRuns: blueprintInfo.maxProductionLimit,
            copyingTime: blueprintInfo.copyingTime || 0
          });
        } else {
          Logger.log(`[ESIManager] No blueprint info found for: ${name} (TypeID: ${typeId})`);
        }
      });

      Logger.log(`[ESIManager] Final results: ${matchCount} blueprints found out of ${uniqueNames.length} unique names`);
      return result;
    } catch (error) {
      Logger.log(`[ESIManager] Error processing blueprints: ${error}`);
      return new Map();
    }
  }

  /**
   * Resolve type IDs for multiple names at once
   * @private
   * @param {string[]} names - Array of unique names to resolve
   * @returns {Promise<Map<string, number>>} Map of lowercase name to type ID
   */
  static async resolveTypeIds(names) {
    Logger.log(`[ESIManager] Starting type ID resolution for ${names.length} names`);
    
    // Ensure all names are unique and non-empty
    const uniqueNames = [...new Set(names.filter(name => name && name.trim()))];
    Logger.log(`[ESIManager] After filtering: ${uniqueNames.length} unique non-empty names`);
    
    if (uniqueNames.length === 0) {
      Logger.log('[ESIManager] No valid names to resolve');
      return new Map();
    }

    const url = 'https://esi.evetech.net/latest/universe/ids/?datasource=tranquility';
    const options = {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(uniqueNames),
      muteHttpExceptions: true
    };

    Logger.log(`[ESIManager] Sending request to ESI with ${uniqueNames.length} names`);
    const response = await UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode !== 200) {
      const errorText = response.getContentText();
      Logger.log(`[ESIManager] ESI request failed (${responseCode}): ${errorText}`);
      Logger.log(`[ESIManager] Request payload was: ${options.payload}`);
      return new Map();
    }
    
    const data = JSON.parse(response.getContentText());
    const result = new Map();
    
    if (data.inventory_types) {
      data.inventory_types.forEach(item => {
        result.set(item.name.toLowerCase(), item.id);
      });
      Logger.log(`[ESIManager] ESI resolved ${result.size} type IDs`);
      
      // Log names that weren't resolved
      const unresolvedNames = uniqueNames.filter(name => 
        !result.has(name.toLowerCase())
      );
      if (unresolvedNames.length > 0) {
        Logger.log(`[ESIManager] Failed to resolve ${unresolvedNames.length} names: ${unresolvedNames.join(', ')}`);
      }
    } else {
      Logger.log('[ESIManager] No inventory types found in ESI response');
    }
    
    return result;
  }

  /**
   * Resolve single type ID
   * @private
   * @param {string} name - Name to resolve
   * @returns {Promise<number|null>} Type ID
   */
  static async resolveTypeId(name) {
    const idMap = await this.resolveTypeIds([name]);
    return idMap.get(name.toLowerCase()) || null;
  }

  /**
   * Get type and blueprint information in parallel
   * @private
   * @param {number} typeId - Type ID to look up
   * @returns {Promise<[Object|null, Object|null]>} Type and blueprint info
   */
  static async getTypeAndBlueprintInfo(typeId) {
    const typeUrl = `https://esi.evetech.net/latest/universe/types/${typeId}/?datasource=tranquility`;
    const options = {
      muteHttpExceptions: true
    };

    // Get type info first
    const typeResponse = await UrlFetchApp.fetch(typeUrl, options);
    if (typeResponse.getResponseCode() !== 200) {
      return [null, null];
    }

    const typeData = JSON.parse(typeResponse.getContentText());
    let blueprintId = null;

    // Find blueprint ID in attributes
    if (typeData.dogma_attributes) {
      const blueprintAttr = typeData.dogma_attributes.find(attr => attr.attribute_id === 2);
      if (blueprintAttr) {
        blueprintId = blueprintAttr.value;
      }
    }

    if (!blueprintId) {
      return [typeData, null];
    }

    // Get blueprint info
    const blueprintUrl = `https://esi.evetech.net/latest/universe/types/${blueprintId}/?datasource=tranquility`;
    const blueprintResponse = await UrlFetchApp.fetch(blueprintUrl, options);
    if (blueprintResponse.getResponseCode() !== 200) {
      return [typeData, null];
    }

    const blueprintData = JSON.parse(blueprintResponse.getContentText());
    let maxRuns = 1;

    if (blueprintData.dogma_attributes) {
      const maxRunsAttr = blueprintData.dogma_attributes.find(attr => attr.attribute_id === 275);
      if (maxRunsAttr) {
        maxRuns = maxRunsAttr.value;
      }
    }

    const blueprintInfo = {
      id: blueprintId,
      name: blueprintData.name,
      maxRuns: maxRuns,
      description: blueprintData.description
    };

    return [typeData, blueprintInfo];
  }
} 