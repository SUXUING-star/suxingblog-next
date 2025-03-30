// src/services/CommentApiService.ts
import { SimpleComment } from '../types/types'; // 确保导入 SimpleComment
import { ApiResponse, fetchApi } from './apiUtils';

class CommentApiService {
	private getEndpoint(postId: string): string {
		return `/posts/${postId}/comments`;
	}

	getComments(postId: string): Promise<ApiResponse<SimpleComment[]>> {
		return fetchApi<SimpleComment[]>(this.getEndpoint(postId), {
			method: 'GET',
		});
	}

	addComment(postId: string, content: string): Promise<ApiResponse<SimpleComment>> {
        if (!content || !content.trim()) {
            return Promise.reject(new Error('评论内容不能为空'));
        }
		return fetchApi<SimpleComment>(this.getEndpoint(postId), {
			method: 'POST',
			body: JSON.stringify({ content: content.trim() }),
		});
	}

    // --- !! 添加删除评论的方法 !! ---
    /**
	 * 删除评论
	 * @param postId - 帖子 ID
     * @param commentId - 评论 ID
	 * @returns Promise (后端成功通常返回 200 OK 或 204 No Content，data 可能为空)
	 */
    deleteComment(postId: string, commentId: string): Promise<ApiResponse<{}>> { // data 可以是空对象 {} 或 void
       // 构建删除特定评论的 URL: /posts/{postId}/comments/{commentId}
       const specificCommentEndpoint = `${this.getEndpoint(postId)}/${commentId}`;
       console.log(`CommentApiService: Deleting comment at ${specificCommentEndpoint}`);
       return fetchApi<{}>(specificCommentEndpoint, { // 泛型设为 {}
           method: 'DELETE',
           // 删除操作需要认证，fetchApi 应该会自动添加 Authorization header
       });
    }
    // --- 结束添加 ---
}

export const commentApiService = new CommentApiService();