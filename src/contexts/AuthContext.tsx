import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface UserProfile {
  id: string;
  uid: string;
  nome: string;
  email: string;
  login: string;
  perfil: string;
  status: string;
}

interface AuthContextType {
  user: any;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  // [EDITABLE_START:auth_state_control]
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // [EDITABLE_END:auth_state_control]

  // [EDITABLE_START:auth_fetch_user_data]
  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .eq('status', 'Ativo')
      .single();

    if (error || !data) {
      console.error('Perfil não encontrado:', error);
      return null;
    }
    return data;
  };
  // [EDITABLE_END:auth_fetch_user_data]

  // [EDITABLE_START:auth_useeffect_session]
  useEffect(() => {
    let mounted = true;
    let currentUserId: string | null = null;
    let initialLoad = true;

    const handleSession = async (sessionUser: any, event: string | null = null) => {
      const userId = sessionUser?.id || null;
      const forceUpdate = event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED';
      const userIdChanged = currentUserId !== userId;
      
      if (userIdChanged) {
        currentUserId = userId;
        if (mounted) setUser(sessionUser);
      }

      if (userIdChanged || forceUpdate) {
        if (sessionUser) {
          const p = await fetchProfile(sessionUser.id);
          if (mounted) setProfile(p);
        } else {
          if (mounted) setProfile(null);
        }
      }
      
      if (mounted && initialLoad) {
        initialLoad = false;
        setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session?.user ?? null, 'INITIAL');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        handleSession(session?.user ?? null, event);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);
  // [EDITABLE_END:auth_useeffect_session]

  // [EDITABLE_START:auth_logout_execute]
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };
  // [EDITABLE_END:auth_logout_execute]

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
