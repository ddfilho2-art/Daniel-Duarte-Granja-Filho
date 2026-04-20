import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { loginWithLogin } from '../lib/authService';

interface UserProfile {
  id: string;
  uid: string;
  nome: string;
  email: string;
  login: string;
  perfil: string;
  status: string;
  avatar_url?: string;
  cargo?: string;
  matricula?: string;
  unidade_negocio_id?: string;
  resume_completed?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  profile: UserProfile | null;
  authLoading: boolean;
  profileLoading: boolean;
  isAuthenticated: boolean;
  loading: boolean;
  login: (loginInput: string, passwordInput?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => void; // 🔥 NOVO
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  authLoading: true,
  profileLoading: true,
  isAuthenticated: false,
  loading: true,
  login: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
  updateProfile: () => {}, // 🔥 NOVO
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('session');
    if (stored) {
      try {
        setProfile(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse session', e);
      }
    }
    setAuthLoading(false);
  }, []);

  const login = async (loginInput: string, passwordInput?: string) => {
    setAuthLoading(true);
    try {
      const session = await loginWithLogin(loginInput, passwordInput);
      setProfile(session as UserProfile);

      // 🔥 salva sessão
      localStorage.setItem('session', JSON.stringify(session));

    } finally {
      setAuthLoading(false);
    }
  };

  const signOut = async () => {
    localStorage.removeItem('session');
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (profile?.login) {
      try {
        const session = await loginWithLogin(profile.login);
        setProfile(session as UserProfile);

        // 🔥 atualiza storage
        localStorage.setItem('session', JSON.stringify(session));

      } catch (e) {
        console.error('Failed to refresh profile', e);
      }
    }
  };

  // 🔥🔥🔥 AQUI ESTÁ A CORREÇÃO PRINCIPAL
  const updateProfile = (data: Partial<UserProfile>) => {
    console.log("♻️ [UPDATE PROFILE CONTEXT]:", data);

    setProfile((prev) => {
      if (!prev) return prev;

      const updated = {
        ...prev,
        ...data, // 🔥 merge correto
      };

      // 🔥 mantém sincronizado com localStorage
      localStorage.setItem('session', JSON.stringify(updated));

      return updated;
    });
  };

  const isAuthenticated = !!profile;

  return (
    <AuthContext.Provider
      value={{
        user: profile,
        profile,
        authLoading,
        profileLoading: authLoading,
        isAuthenticated,
        loading: authLoading,
        login,
        signOut,
        refreshProfile,
        updateProfile // 🔥 EXPORTANDO
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);