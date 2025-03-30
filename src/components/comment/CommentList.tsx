// src/components/CommentList.tsx
import React, { useState } from 'react'; // 引入 useState 用于处理删除加载状态
import { SimpleComment } from '../../types/types';
// --- !! 引入 useAuth !! ---
import { useAuth } from '../../context/AuthContext';
import { Stack, Box, Text, Group, Paper, ThemeIcon, ActionIcon, Tooltip } from '@mantine/core';
// --- !! 引入删除图标和可能的API服务 !! ---
import { IconUserCircle, IconTrash, IconLoader } from '@tabler/icons-react';
import { commentApiService } from '../../services/CommentService'; // 用于调用删除 API
import { notifications } from '@mantine/notifications'; // 用于显示提示信息

interface CommentListProps {
	postId: string; // <-- !! 需要 postId 来调用删除 API !!
	comments: SimpleComment[];
	isLoading: boolean;
	error?: string | null;
	// --- !! 添加一个回调函数，当评论被删除时通知父组件更新状态 !! ---
	onCommentDeleted: (deletedCommentId: string) => void;
}

const CommentList: React.FC<CommentListProps> = ({
	postId, // 接收 postId
	comments,
	isLoading,
	error,
	onCommentDeleted, // 接收回调
}) => {
	// --- !! 获取当前登录用户 !! ---
	const { user, isInitialized } = useAuth();
	// --- !! 添加状态来跟踪哪个评论正在被删除 !! ---
	const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

	// --- 处理删除按钮点击事件 ---
	const handleDeleteClick = async (commentId: string) => {
		if (!postId) {
			console.error("Post ID is missing, cannot delete comment.");
			notifications.show({ color: 'red', title: '错误', message: '无法删除评论，缺少帖子 ID' });
			return;
		}
		if (deletingCommentId) return; // 防止重复点击

		setDeletingCommentId(commentId); // 设置正在删除的状态

		try {
			console.log(`Attempting to delete comment ${commentId} for post ${postId}`);
			const response = await commentApiService.deleteComment(postId, commentId);

			if (response.success) {
				console.log(`Successfully deleted comment ${commentId}`);
				notifications.show({ color: 'green', title: '成功', message: '评论已删除' });
				// --- !! 调用父组件的回调来更新 UI !! ---
				onCommentDeleted(commentId);
			} else {
				// API 返回 success: false 的情况
				const message = Array.isArray(response.message) ? response.message.join(', ') : response.message;
				console.error(`Failed to delete comment ${commentId}: ${message}`);
				notifications.show({ color: 'red', title: '删除失败', message: message || '无法删除评论' });
			}
		} catch (err: any) {
			// 网络错误或其他异常
			console.error(`Error deleting comment ${commentId}:`, err);
			const errorMessage = err instanceof Error ? err.message : '删除评论时发生未知错误';
			notifications.show({ color: 'red', title: '删除失败', message: errorMessage });
		} finally {
			setDeletingCommentId(null); // 清除正在删除的状态，无论成功或失败
		}
	};


	// --- Loading, Error, Empty 状态处理 (保持不变) ---
	if (isLoading) { /* ... */ }
	if (error) { /* ... */ }
	if (!comments || comments.length === 0) { /* ... */ }

	// --- 渲染列表 ---
	return (
		<Stack gap="lg" mt="xl">
			{comments.map((comment) => {
				// --- !! 检查是否显示删除按钮 !! ---
				// 条件：AuthContext 初始化完成，用户已登录，且评论作者是当前用户
				const canDelete = isInitialized && user && user.id === comment.authorId;
				const isDeleting = deletingCommentId === comment._id; // 是否正在删除当前评论

				return (
					<Paper key={comment._id} p="md" withBorder radius="md">
						<Group align="flex-start" wrap="nowrap">
							<ThemeIcon size="lg" radius="xl" variant="light" mt={4}>
								<IconUserCircle size={20} />
							</ThemeIcon>

							<Box style={{ flex: 1 }}>
								<Group justify="space-between" align="center" mb={2}>
									<Text fw={500} size="sm">{comment.authorName}</Text>
									{/* --- !! 在时间旁边或下面添加删除按钮 !! --- */}
									<Group gap="xs" align="center">
										<Text size="xs" c="dimmed">{new Date(comment.createdAt).toLocaleString()}</Text>
										{/* --- !! 条件渲染删除按钮 !! --- */}
										{canDelete && (
											<Tooltip label="删除评论" withArrow position="top">
												<ActionIcon
													variant="subtle"
													color="red"
													size="sm"
													onClick={() => handleDeleteClick(comment._id)}
													disabled={isDeleting} // 正在删除时禁用按钮
													aria-label="删除评论"
												>
													{/* --- !! 显示加载图标或删除图标 !! --- */}
													{isDeleting ? <IconLoader size={16} className="animate-spin" /> : <IconTrash size={16} />}
												</ActionIcon>
											</Tooltip>
										)}
									</Group>
								</Group>
								<Text size="sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
									{comment.content}
								</Text>
							</Box>
						</Group>
					</Paper>
				);
			})}
		</Stack>
	);
};

export default CommentList;