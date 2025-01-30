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
    DAILY_LOCATION: 1000000,
    RUN_RATES: {
      'Compo T1': 250,
      'Module T1': 10000,
      'Ship T1': 100000,
      'Module T2': 100000,
      'Ship T2': 2500000,
      'Cap T1': 25000,
      'Cap T2': 125000
    }
  },
  RANGES: {
    DASHBOARD: 'A1:F53',
    BPC_BPO: 'A55:K500',
    REACTIONS: 'A589:K878',
    COMPONENTS: 'A881:K1042',
    PRODUCTS: 'A1048:K2000',
    MATERIALS: 'A505:P536',  // Range for materials data
    HYBRID_REACTIONS: 'H2:K50',  // Range for hybrid reactions
    ADVANCED_COMPONENTS: 'M2:P50',  // Range for advanced components
    CAPITAL_COMPONENTS: 'R2:U50',  // Range for capital components
    END_PRODUCTS: 'W2:Z50',  // Range for end products
    OTHERS: 'AB2:AE50',  // Range for other jobs
    CASH_FLOWS: 'AG2:AH20'  // Range for cash flow data
  },
  NAMED_RANGES: {
    DASHBOARD_STATS: 'A1:F34',
    BPC_BPO: 'G53',
    MATERIALS: 'G501',
    REACTIONS: 'G582',
    COMPONENTS: 'G878',
    PRODUCTS: 'G1043',
    JOB_TYPES: 'B55:B500',
    JOB_STATUS: 'K55:K500'
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