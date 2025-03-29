// src/services/apiUtils.ts
import { TOKEN_STORAGE_KEY } from '../context/AuthContext'; // 假设 AuthContext 导出这个 Key

// 通用 API 响应结构 (也可以放在 types.ts)
export interface ApiResponse<T = any> {
	success: boolean;
	data?: T;
	message?: string | string[];
	pagination?: {
		currentPage: number;
		totalPages: number;
		totalPosts: number; // 或 totalItems
	};
}


export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
	throw new Error("VITE_API_BASE_URL is not defined. Please check your .env file.");
}

// 辅助函数处理 fetch 响应
export async function handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
	const contentType = response.headers.get("content-type");
	let data;

	// 如果没有响应体 (如 204 No Content)，且状态码 OK，则返回成功
	if (!contentType && response.ok && response.status === 204) {
		return { success: true, data: {} as T }; // 代表成功但无数据返回
	}

	// 尝试解析 JSON
	if (contentType && contentType.includes("application/json")) {
		try {
			data = await response.json();
		} catch (e) {
			// JSON 解析失败，但状态码可能 OK，按非 JSON 处理
			if (response.ok) {
				console.warn("Received non-JSON response with OK status:", response.status, await response.text().catch(() => ''));
				return { success: true, data: {} as T }; // 或许返回空对象更合适？
			}
			data = { success: false, message: `Invalid JSON response. Status: ${response.status}` };
		}
	} else {
		// 处理非 JSON 响应
		const text = await response.text().catch(() => `Failed to read response text. Status: ${response.status}`);
		if (response.ok) {
			// 非 JSON 但 OK (不常见)
			console.warn("Received non-JSON response with OK status:", response.status, text);
			return { success: true, data: {} as T }; // 假设成功但无结构化数据
		}
		data = { success: false, message: text || `HTTP Error: ${response.status}` };
	}

	// 检查最终处理后的响应是否 OK
	if (!response.ok) {
		let errorMessage = `HTTP error! Status: ${response.status}`;
		if (data && data.message) {
			errorMessage = Array.isArray(data.message) ? data.message.join(', ') : data.message;
		} else if (!data.message && typeof data === 'string') { // 如果 data 直接是错误字符串
			errorMessage = data;
		}
		console.error("API Error:", errorMessage, "Response:", response);
		throw new Error(errorMessage);
	}

	// 兼容处理: 如果状态 OK 且 data 中没有明确的 success 字段，则认为成功
	if (data && typeof data.success === 'undefined') {
		console.warn("API Response data missing 'success' field, assuming success based on HTTP status.", data);
		data.success = true;
	}
	// 如果状态 OK 但 data 中明确 success: false，按错误处理 (虽然少见，但符合接口定义)
	else if (data && data.success === false) {
		let errorMessage = `API indicated failure despite OK status. Status: ${response.status}`;
		if (data.message) {
			errorMessage = Array.isArray(data.message) ? data.message.join(', ') : data.message;
		}
		console.error("API Error:", errorMessage, "Response:", response);
		throw new Error(errorMessage);
	}


	return data as ApiResponse<T>;
}

// 获取 Token
function getAuthToken(): string | null {
	// 在浏览器环境执行，确保 localStorage 可用
	if (typeof window !== 'undefined') {
		return localStorage.getItem(TOKEN_STORAGE_KEY);
	}
	return null;
}

// 创建 Headers
function createHeaders(includeContentType: boolean = true, customHeaders: HeadersInit = {}): HeadersInit {
	// --- !!! 修改：创建 Headers 实例 !!! ---
	const headers = new Headers(customHeaders); // 可以用 customHeaders 初始化

	if (includeContentType) {
			// --- 使用 .set() 方法 ---
			// (如果 customHeaders 里已经有 Content-Type，这里会覆盖它)
			if (!headers.has('Content-Type')) { // 最好先检查，避免覆盖 customHeaders
				 headers.set('Content-Type', 'application/json');
			}
	}

	const token = getAuthToken();
	if (token) {
			 // --- 使用 .set() 方法 ---
			 headers.set('Authorization', `Bearer ${token}`);
	}

	// --- 返回 Headers 实例，它符合 HeadersInit 类型 ---
	return headers;
}

// 封装 fetch 请求
export async function fetchApi<T>(
    endpoint: string,
    options: RequestInit = {},
    baseUrl: string = API_BASE_URL!
): Promise<ApiResponse<T>> {
    const url = `${baseUrl}${endpoint}`;
    // 自动添加必要的 Headers (如 Content-Type, Authorization)，允许覆盖
    const defaultOptions: RequestInit = {
        headers: createHeaders(!options.body || !(options.body instanceof FormData)), // FormData 不设置 Content-Type
        ...options, // 用户传入的 options 会覆盖默认的 headers
    };

    console.log(`[API Request] ${defaultOptions.method || 'GET'} ${url}`, options.body ? 'with body' : ''); // Log request

    const response = await fetch(url, defaultOptions);

    console.log(`[API Response] ${response.status} ${response.statusText} for ${url}`); // Log response status

    return handleResponse<T>(response);
}