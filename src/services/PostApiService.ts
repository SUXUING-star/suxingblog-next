// src/services/PostApiService.ts
import { IPost, PaginationInfo } from '../types/types'; // 确保路径正确
import { ApiResponse, fetchApi } from './apiUtils';

interface GetPostsParams {
  page?: number;
  limit?: number;
  published?: boolean;
  tags?: string[];
  sort?: string;
	authorId?: string; // <--- 添加 authorId
}

// 如果 API 响应中 pagination 结构不同，定义在这里
//interface PostPaginationData extends PaginationInfo {} // 这里假设与通用类型一致


class PostApiService {
	private endpointBase = '/posts';

	/**
	 * 获取帖子列表
	 * @param params - 分页、过滤、排序参数
	 * @returns Promise 包含帖子数组和分页信息
	 */
	getPosts(params: GetPostsParams = {}): Promise<ApiResponse<IPost[]>> {
		const searchParams = new URLSearchParams();
		if (params.page) searchParams.append('page', params.page.toString());
		if (params.limit) searchParams.append('limit', params.limit.toString());
		if (params.published !== undefined) searchParams.append('published', params.published.toString());
		if (params.tags && params.tags.length > 0) searchParams.append('tags', params.tags.join(','));
		if (params.sort) searchParams.append('sort', params.sort);
		if (params.authorId) searchParams.append('authorId', params.authorId); // <--- 添加这行
		const queryString = searchParams.toString();
        // 注意：需要处理 pagination 数据，之前的 ApiResponse<IPost[]> 没有包含分页，需要修改
        // 我们假设 fetchApi 能处理返回结构，或者手动处理
		return fetchApi<IPost[]>(`${this.endpointBase}${queryString ? `?${queryString}` : ''}`, {
			method: 'GET',
            // fetchApi 会自动处理 Auth 头 (如果 getAuthToken 返回了 token)
		});
        // 如果需要明确处理分页:
        // const result = await fetchApi<{ posts: IPost[], pagination: PostPaginationData }>(...);
        // return { ...result, data: result.data?.posts, pagination: result.data?.pagination };
	}

	/**
	 * 根据 ID 或 Slug 获取单个帖子
	 * @param identifier - 帖子 ID 或 Slug
	 * @returns Promise 包含帖子数据
	 */
	getPostByIdentifier(identifier: string): Promise<ApiResponse<IPost>> {
		return fetchApi<IPost>(`${this.endpointBase}/${identifier}`, {
			method: 'GET',
		});
	}

	getPostById = (id: string): Promise<ApiResponse<IPost>> => this.getPostByIdentifier(id);
	getPostBySlug = (slug: string): Promise<ApiResponse<IPost>> => this.getPostByIdentifier(slug);

	/**
	 * 创建新帖子
	 * @param postData - 帖子数据
	 * @returns Promise 包含新创建的帖子数据
	 */
	createPost(postData: Partial<Omit<IPost, '_id' | 'createdAt' | 'updatedAt'>>): Promise<ApiResponse<IPost>> {
		return fetchApi<IPost>(this.endpointBase, {
			method: 'POST',
			body: JSON.stringify(postData),
            // Auth 头由 fetchApi 自动添加
		});
	}

	/**
	 * 更新帖子
	 * @param id - 帖子 ID (_id)
	 * @param postData - 要更新的数据
	 * @returns Promise 包含更新后的帖子数据
	 */
	updatePost(id: string, postData: Partial<Omit<IPost, '_id' | 'createdAt' | 'updatedAt'>>): Promise<ApiResponse<IPost>> {
		return fetchApi<IPost>(`${this.endpointBase}/${id}`, {
			method: 'PUT',
			body: JSON.stringify(postData),
		});
	}

	/**
	 * 删除帖子
	 * @param id - 帖子 ID (_id)
	 * @returns Promise (成功时 data 为空对象)
	 */
	deletePost(id: string): Promise<ApiResponse<{}>> { // 返回类型是 {}
		return fetchApi<{}>(`${this.endpointBase}/${id}`, {
			method: 'DELETE',
            // DELETE 请求不需要 body，Auth 头由 fetchApi 自动添加
		});
	}
}

// 导出一个单例
export const postApiService = new PostApiService();