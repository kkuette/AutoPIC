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
} 