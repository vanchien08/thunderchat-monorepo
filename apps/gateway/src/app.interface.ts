// Route config for each service
export interface IAPIGatewayRoute {
  path: string
  rewrite?: { [key: string]: string }
  changeOrigin?: boolean
}

// Service config
export interface IAPIGatewayService {
  target: string
  healthCheck: string
  timeout: number
  routes: IAPIGatewayRoute[]
}

// All services
export interface IAPIGatewayServices {
  [serviceName: string]: IAPIGatewayService
}

// Middleware config
export interface IAPIGatewayMiddleware {
  cors?: {
    enabled: boolean
    origins: string[]
    credentials: boolean
    methods: string[]
    allowedHeaders: string[]
  }
  compression?: {
    enabled: boolean
    level: number
  }
  logging?: {
    enabled: boolean
    level: string
    excludePaths?: string[]
  }
  requestId?: {
    enabled: boolean
    header: string
  }
  circuitBreaker?: {
    enabled: boolean
    threshold: number
    timeout: number
    resetTimeout: number
  }
}

// Load balancing config
export interface IAPIGatewayLoadBalancing {
  strategy: string
  healthCheckInterval: number
  retries: number
}

// Security config
export interface IAPIGatewaySecurity {
  helmet?: { enabled: boolean }
  rateLimitGlobal?: { enabled: boolean; max: number; windowMs: number }
  ipWhitelist?: { enabled: boolean; ips: string[] }
}

// Monitoring config
export interface IAPIGatewayMonitoring {
  metrics?: { enabled: boolean; path: string }
  tracing?: { enabled: boolean; serviceName: string }
}

// Root config
export interface IAPIGatewayRouting {
  services: IAPIGatewayServices
  middleware?: IAPIGatewayMiddleware
  loadBalancing?: IAPIGatewayLoadBalancing
  security?: IAPIGatewaySecurity
  monitoring?: IAPIGatewayMonitoring
}

export interface IGuardedRoute {
  path: string
}

export interface IGuardedRoutes {
  services: {
    [serviceName: string]: {
      routes: IGuardedRoute[]
    }
  }
}
