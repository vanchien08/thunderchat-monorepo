export type TJWTCookieOptions = {
  maxAge: number
  path: string
  httpOnly: boolean
  secure: boolean
  domain: string
  sameSite: 'strict' | 'lax' | 'none'
}
