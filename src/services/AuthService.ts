// src/services/AuthApiService.ts
import { LoginCredentials, RegisterCredentials, UserData } from '../types/types'; // 确保路径正确
import { ApiResponse, fetchApi } from './apiUtils';

class AuthApiService {
	private endpointBase = '/auth';

	/**
	 * 用户登录
	 * @param credentials - 邮箱和密码
	 * @returns Promise 包含 token 和 user 数据
	 */
	login(credentials: LoginCredentials): Promise<ApiResponse<{ token: string; user: UserData }>> {
		return fetchApi<{ token: string; user: UserData }>(`${this.endpointBase}/login`, {
			method: 'POST',
			body: JSON.stringify(credentials),
			// headers 由 fetchApi 自动处理
		});
	}

	/**
	 * 用户注册
	 * @param credentials - 邮箱、密码等注册信息
	 * @returns Promise 包含成功消息
	 */
	register(credentials: RegisterCredentials): Promise<ApiResponse<{ message: string }>> {
		return fetchApi<{ message: string }>(`${this.endpointBase}/register`, {
			method: 'POST',
			body: JSON.stringify(credentials),
		});
	}

    /**
	 * 获取当前用户信息 (如果后端实现了 /api/auth/me)
	 * @returns Promise 包含用户数据
	 */
    // async getMe(): Promise<ApiResponse<UserData>> {
    //    // GET 请求通常不需要 body
    //    return fetchApi<UserData>('/auth/me', { // 假设有这个接口
    //         method: 'GET',
    //         // GET 通常不需要 Content-Type, fetchApi 会处理 Auth 头
    //    });
    // }

}

// 导出一个单例
export const authApiService = new AuthApiService();