import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';

interface BackendLoginResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role?: string;
  };
}

async function verifyCredentials(email: string, password: string): Promise<BackendLoginResponse | null> {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  
  try {
    const response = await fetch(`${backendUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    // 确保返回正确格式
    if (data.access_token && data.user) {
      return data as BackendLoginResponse;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const result = await verifyCredentials(credentials.email, credentials.password);
        
        if (!result || !result.user) {
          return null;
        }

        return {
          id: String(result.user.id),
          email: String(result.user.email),
          name: String(result.user.name || result.user.email.split('@')[0]),
          // 保存后端的 accessToken
          accessToken: result.access_token,
          role: (result.user.role || 'user') as 'user' | 'admin' | 'viewer',
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // 首次登录
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = (user as any).role || 'user';
        // 保存后端的 accessToken
        token.accessToken = (user as any).accessToken;
      }
      
      // 支持会话更新（session update）
      if (trigger === 'update' && session) {
        if (session.accessToken) {
          token.accessToken = session.accessToken;
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).email = token.email;
        (session.user as any).name = token.name;
        (session.user as any).role = token.role;
        // 暴露 accessToken 给前端
        (session as any).accessToken = token.accessToken;
      }
      
      // Store accessToken in localStorage for API client access
      if (typeof window !== 'undefined' && typeof token.accessToken === 'string') {
        try {
          localStorage.setItem('accessToken', token.accessToken);
        } catch (e) {
          // Silently handle storage errors
        }
      }
      
      return session;
    },
  },
};
