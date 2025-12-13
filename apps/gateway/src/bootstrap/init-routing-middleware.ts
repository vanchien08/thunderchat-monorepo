import type { IAPIGatewayRouting } from '@/app.interface'
import { DevLogger } from '@/dev/dev-logger'
import { ERequestHeaders } from '@/utils/enums'
import { loadJSONFileSync } from '@/utils/helpers'
import { NestExpressApplication } from '@nestjs/platform-express'
import { ClientRequest, IncomingMessage } from 'http'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { join } from 'path'

const addXUserDataHeader = (proxyReq: ClientRequest, req: IncomingMessage) => {
  const user = req['user'] || null

  if (user) {
    proxyReq.setHeader(
      ERequestHeaders.X_USER_DATA,
      Buffer.from(JSON.stringify(user)).toString('base64')
    )
  }
}

export const initRouting = (app: NestExpressApplication, apiPrefix: string) => {
  const config = loadJSONFileSync<IAPIGatewayRouting>(
    join(__dirname, '/../../../assets/routing/', 'api-gateway-routing.json')
  )
  if (!config) return

  const { services } = config
  for (const serviceName in services) {
    const { routes, timeout, target } = services[serviceName]
    for (const { path, rewrite, changeOrigin } of routes) {
      const mountPath = `/${apiPrefix}${path}`
      console.log(`>>> [GATEWAY] Registering proxy route: ${mountPath} -> ${target}`)
      console.log(`>>> [GATEWAY] Rewrite rule:`, rewrite)
      
      app.use(
        mountPath,
        (req, res, next) => {
          console.log(`>>> [GATEWAY] Matched route ${mountPath} for request: ${req.method} ${req.originalUrl}`)
          next()
        },
        createProxyMiddleware({
          target,
          changeOrigin,
          timeout,
          pathRewrite: rewrite,
          on: {
            proxyReq: (proxyReq, req, res) => {
              addXUserDataHeader(proxyReq, req)
              console.log(`>>> [GATEWAY] Proxying ${req.method} ${req.url} to ${target}${proxyReq.path}`)
              DevLogger.logInfo(
                `Proxying request from ${req['user']} to ${serviceName}: ${target + req.url}`
              )
            },
            proxyRes: (proxyRes, req, res) => {
              console.log(`>>> [GATEWAY] Response from ${serviceName}: ${proxyRes.statusCode}`)
              DevLogger.logInfo(`Received response from ${serviceName}: ${proxyRes.statusCode}`)
            },
          },
        })
      )
    }
  }
}
