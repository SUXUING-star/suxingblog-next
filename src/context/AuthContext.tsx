// src/context/AuthContext.tsx
import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { authApiService } from '../services/AuthService'; // 导入你的 API 服务
import { LoginCredentials, RegisterCredentials, UserData } from '../types/types'; // 假设 UserData 在 types.ts 定义
import { Loader, Center } from '@mantine/core';

interface AuthContextType {
	token: string | null;
	user: UserData | null; // UserData 应该包含 id, email, name?
	isLoading: boolean; // 用于跟踪初始加载或登录/注册过程
	isInitialized: boolean; // 标记 context 是否已从 localStorage 初始化
	error: string | null;   // 存储登录/注册错误
	login: (credentials: LoginCredentials) => Promise<boolean>;
	register: (credentials: RegisterCredentials) => Promise<boolean>;
	logout: () => void;
	clearError: () => void; // 清除错误状态
}

// 创建 Context，提供默认值
const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
	children: ReactNode;
}

// 定义存储在 localStorage 中的 key
export const TOKEN_STORAGE_KEY = 'authToken';
const USER_STORAGE_KEY = 'userData';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
	const [token, setToken] = useState<string | null>(null);
	const [user, setUser] = useState<UserData | null>(null);
	const [isLoading, setIsLoading] = useState(false); // 初始检查 loading 稍后处理
	const [isInitialized, setIsInitialized] = useState(false); // 标记初始化完成
	const [error, setError] = useState<string | null>(null);

	// --- 初始化: 组件挂载时尝试从 localStorage 加载 token 和 user ---
	useEffect(() => {
		console.log('AuthContext: Initializing...');
		const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
		const storedUserString = localStorage.getItem(USER_STORAGE_KEY);

		if (storedToken) {
			console.log('AuthContext: Found token in localStorage');
			setToken(storedToken);
			if (storedUserString) {
				try {
					const storedUser = JSON.parse(storedUserString) as UserData;
					setUser(storedUser);
					console.log('AuthContext: Found user in localStorage', storedUser);
				} catch (e) {
					console.error('AuthContext: Failed to parse stored user data', e);
					localStorage.removeItem(USER_STORAGE_KEY); // 解析失败则移除
				}
			} else {
				// 如果只有 token 没有 user，可以考虑发起请求获取 /api/auth/me (如果实现了)
				console.log('AuthContext: Token found but no user data, might need to fetch user details.');
			}
			// 注意：这里没有验证 token 是否过期，实际应用需要验证
			// 可以解码 token 检查 exp，或者发起一个需要认证的请求看是否 401
		}
		// 标记初始化完成，无论是否找到 token
		setIsInitialized(true);
		console.log('AuthContext: Initialization complete.');
	}, []); // 空依赖数组，只在挂载时运行一次


	// --- 清除错误 ---
	const clearError = useCallback(() => setError(null), []);

	// --- 登录 ---
	const login = useCallback(async (credentials: LoginCredentials): Promise<boolean> => {
		clearError();
		setIsLoading(true);
		try {
			const response = await authApiService.login(credentials); // 调用 API
			if (response.success && response.data) {
				const { token: receivedToken, user: receivedUser } = response.data;
				console.log('AuthContext: Login successful', receivedUser);
				setToken(receivedToken);
				setUser(receivedUser);
				localStorage.setItem(TOKEN_STORAGE_KEY, receivedToken);
				localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(receivedUser));
				setIsLoading(false);
				return true; // 登录成功
			} else {
				const message = Array.isArray(response.message) ? response.message.join(', ') : response.message;
				throw new Error(message || 'Login failed');
			}
		} catch (err: any) {
			console.error('AuthContext: Login error:', err);
			const errorMessage = err instanceof Error ? err.message : 'Login failed. Please check your credentials.';
			setError(errorMessage);
			setIsLoading(false);
			return false; // 登录失败
		}
	}, [clearError]);

	// --- 注册 ---
	const register = useCallback(async (credentials: RegisterCredentials): Promise<boolean> => {
		clearError();
		setIsLoading(true);
		try {
			const response = await authApiService.register(credentials); // 调用 API
			if (response.success) {
				console.log('AuthContext: Registration successful');
				// 注册成功后可以选择：
				// 1. 显示成功消息，让用户去登录
				// 2. 自动调用 login 函数进行登录 (如果 API 支持或分开调用)
				setIsLoading(false);
				return true; // 注册成功
			} else {
				const message = Array.isArray(response.message) ? response.message.join(', ') : response.message;
				throw new Error(message || 'Registration failed');
			}
		} catch (err: any) {
			console.error('AuthContext: Registration error:', err);
			const errorMessage = err instanceof Error ? err.message : 'Registration failed. Please try again.';
			setError(errorMessage);
			setIsLoading(false);
			return false; // 注册失败
		}
	}, [clearError]);

	// --- 登出 ---
	const logout = useCallback(() => {
    console.log('AuthContext: Logging out'); // 确认函数被调用
    setToken(null); // 清除 token 状态
    setUser(null); // 清除 user 状态
    localStorage.removeItem(TOKEN_STORAGE_KEY); // 从 localStorage 移除 token
    localStorage.removeItem(USER_STORAGE_KEY); // 从 localStorage 移除 user
    // 如果需要，可以在这里添加其他清理逻辑，比如跳转到首页或登录页
    // navigate('/'); // 如果引入了 useNavigate
  }, []); // 空依赖数组，引用稳定


	// Context 的值
	const contextValue: AuthContextType = {
		token,
		user,
		isLoading,
		isInitialized,
		error,
		login,
		register,
		logout,
		clearError,
	};

	// 只有在初始化完成后才渲染子组件，防止页面闪烁
	if (!isInitialized) {
		// 可以显示一个全局加载指示器
		return <Center style={{ height: '100vh' }}><Loader /></Center>;
	}


	return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

// --- 自定义 Hook，方便在组件中使用 Context ---
export const useAuth = (): AuthContextType => {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
};