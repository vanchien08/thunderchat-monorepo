import type { TUser } from '@/utils/entities/user.entity'

export type TUserId = TUser['id']

export type TCreateUserParams = {
  email: string
  password: string
  fullName: string
  birthday: Date
}

export type TSearchProfilesData = {
  id: number
  User: {
    id: number
    email: string
  }
  fullName: string
  avatar: string | null
}

export type TSearchUsersData = {
  id: number
  email: string
  Profile: {
    id: number
    fullName: string
    avatar: string | null
  } | null
}
