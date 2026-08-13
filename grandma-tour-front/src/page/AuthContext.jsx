import { useState } from 'react'
import AuthContext from './auth-context'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  const value = {
    user,
    isLoggedIn: Boolean(user),
    login: (userData) => setUser(userData),
    logout: () => setUser(null),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
