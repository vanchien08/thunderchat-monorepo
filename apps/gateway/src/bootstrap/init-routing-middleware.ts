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
      app.use(
        `/${apiPrefix}${path}`,
        createProxyMiddleware({
          target,
          changeOrigin,
          timeout,
          pathRewrite: rewrite,
          on: {
            proxyReq: (proxyReq, req, res) => {
              addXUserDataHeader(proxyReq, req)
              DevLogger.logInfo(
                `Proxying request from ${req['user']} to ${serviceName}: ${target + req.url}`
              )
            },
            proxyRes: (proxyRes, req, res) => {
              DevLogger.logInfo(`Received response from ${serviceName}: ${proxyRes.statusCode}`)
            },
          },
        })
      )
    }
  }
}