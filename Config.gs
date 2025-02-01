const CONFIG = {
  ESI: {
    BASE_URL: 'https://esi.evetech.net/latest',
    // Pre-configured application for PIC Industry Manager
    CLIENT_ID: '714f99ab76b7490d9912660bea879c36',  // PIC Industry Manager App
    CLIENT_SECRET: 'rrSnn0Xqf6zoaNToUAgFREMcz7q1xounJqOFilwd',
    CALLBACK_URL: 'https://script.google.com/macros/d/1SmbL0gE8-JgsdQBxsZdSlBwTacoCCyNcYbxzRd4XZKZqmZz4kvnPUvVU/usercallback',
    SCOPES: [
      'esi-corporations.read_structures.v1',
      'esi-characters.read_corporation_roles.v1',
      'esi-assets.read_corporation_assets.v1',
      'esi-industry.read_corporation_jobs.v1',
      'esi-corporations.read_container_logs.v1'
    ],
    CACHE_DURATIONS: {
      MARKET_PRICES: 3600, // 1 hour
      INDUSTRY_JOBS: 300,  // 5 minutes
      ASSETS: 3600,        // 1 hour
      TYPES: 86400        // 24 hours
    }
  },
  FEES: {
    DAILY_LOCATION: `B15`,
    RUN_RATES: `A15:B22`
  },
  RANGES: {
    DASHBOARD: 'A1:F53',
    BPC_BPO: 'A55:E500',
    REACTIONS: 'A589:F590',
    COMPONENTS: 'A881:F882',
    PRODUCTS: 'A1048:F1049',
    MATERIALS: 'A505:P510',
  },
  NAMED_RANGES: {
    DASHBOARD_STATS: 'A1:F34',
    BPC_BPO: 'G53',
    MATERIALS: 'G501',
    REACTIONS: 'G582',
    COMPONENTS: 'G878',
    PRODUCTS: 'G1043',
  },
  API: {
    RAVWORKS: {
      BASE_URL: 'https://www.ravworks.com',
      ENDPOINTS: {
        PLAN: '/plan'
      }
    }
  }
}; 