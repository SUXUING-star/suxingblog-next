// src/services/CommentApiService.ts
import { SimpleComment, IPost } from '../types/types'; // 假设 IComment 是后端的完整评论模型
import { ApiResponse, fetchApi } from './apiUtils';

class CommentApiService {
	private getEndpoint(postId: string): string {
		return `/posts/${postId}/comments`; // 评论是帖子的子资源
	}

	/**
	 * 获取指定帖子的评论列表
	 * @param postId - 帖子 ID
	 * @returns Promise 包含评论数组
	 */
	getComments(postId: string): Promise<ApiResponse<SimpleComment[]>> { // 假设前端只关心简单评论
		return fetchApi<SimpleComment[]>(this.getEndpoint(postId), {
			method: 'GET',
             // GET 通常不需要认证即可查看评论
		});
	}

	/**
	 * 为指定帖子添加评论
	 * @param postId - 帖子 ID
	 * @param content - 评论内容
	 * @returns Promise 包含新创建的评论数据 (假设后端返回新评论)
	 */
	addComment(postId: string, content: string): Promise<ApiResponse<IPost>> {
        if (!content || !content.trim()) {
            // 可以在调用 API 前进行简单的前端验证
            return Promise.reject(new Error('Comment content cannot be empty.'));
        }
		return fetchApi<IPost>(this.getEndpoint(postId), { // 假设后端返回的是 IComment 类型
			method: 'POST',
			body: JSON.stringify({ content: content.trim() }),
            // 添加评论通常需要登录，Auth 头由 fetchApi 自动处理
		});
	}

    /**
	 * 删除评论 (如果后端实现了)
	 * @param postId - 帖子 ID
     * @param commentId - 评论 ID
	 * @returns Promise
	 */
    // deleteComment(postId: string, commentId: string): Promise<ApiResponse<{}>> {
    //    return fetchApi<{}>(`${this.getEndpoint(postId)}/${commentId}`, {
    //        method: 'DELETE',
    //        // 删除评论通常需要登录和权限检查，Auth 头由 fetchApi 自动处理
    //    });
    //}
}

// 导出一个单例
export const commentApiService = new CommentApiService();