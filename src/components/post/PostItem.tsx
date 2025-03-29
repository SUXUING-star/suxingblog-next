// src/components/PostItem.mantine.tsx
import React from 'react';
import { IPost } from '../../types/types'; // 确保 IPost 类型定义了作者信息
import { Paper, Title, Text, Badge, Group, ActionIcon, Tooltip, Stack, Anchor } from '@mantine/core';
import { IconPencil, IconTrash, IconExternalLink } from '@tabler/icons-react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext'; // 引入 useAuth

interface PostItemProps {
	post: IPost; // <--- 确保 IPost 类型包含作者 ID，例如 authorId: string;
	onEdit: (post: IPost) => void;
	onDelete: (id: string) => void;
	isEditingOther: boolean;
}

const PostItem: React.FC<PostItemProps> = ({ post, onEdit, onDelete, isEditingOther }) => {
	const disabled = isEditingOther;
	// 同时获取 token 和 user 对象
	const { token, user } = useAuth();

	// --- 新增：判断当前登录用户是否是帖子作者 ---
	// 使用可选链 (?.) 防止 user 或 post.authorId 不存在时报错
	// !! 重要 !!: 请确保 post 对象上有 authorId 字段，并且 user 对象上有 id 字段
	// 如果你的作者 ID 字段名是别的（比如 post.author._id），请修改这里
	const isCurrentUserAuthor = user && post.authorId && user.id === post.authorId;
    // 如果你的 post.author 是一个对象，可能是这样：
    // const isCurrentUserAuthor = user && post.author && user.id === post.author._id; // 或者 post.author.id

	return (
		<Paper shadow="xs" p="lg" radius="md" withBorder>
			<Stack gap="md">
				<Group justify="space-between">
					<Anchor component={RouterLink} to={`/posts/${post.slug}`} underline="hover">
						<Title order={3} size="h4" lineClamp={1}>
							{post.title}
						</Title>
					</Anchor>
					<Badge color={post.isPublished ? 'green' : 'yellow'} variant="light" size="sm">
						{post.isPublished ? '已发布' : '草稿'}
					</Badge>
				</Group>

				<Text size="xs" c="dimmed">
					创建于: {new Date(post.createdAt).toLocaleDateString()}
					{post.isPublished && post.publishedAt && ` • 发布于 ${new Date(post.publishedAt).toLocaleDateString()}`}
					{/* 可以选择性地显示作者信息，如果 post 对象里有的话 */}
					{/* {post.author?.name && ` • 作者: ${post.author.name}`} */}
				</Text>

				{post.excerpt && <Text size="sm" c="dimmed" lineClamp={2}>{post.excerpt}</Text>}

				{post.tags && post.tags.length > 0 && (
					<Group gap={4}>
						{post.tags.map(tag => <Badge key={tag} color="blue" variant="light" size="xs">{tag}</Badge>)}
					</Group>
				)}

				<Group justify="flex-end" gap="xs" mt="sm">
					{/* --- 修改条件渲染逻辑 --- */}
					{/* 必须同时满足：用户已登录 (token 存在) 并且 当前用户是作者 (isCurrentUserAuthor 为 true) */}
					{token && isCurrentUserAuthor && (
						<>
							<Tooltip label="编辑帖子">
								<ActionIcon variant="light" color="yellow" onClick={() => onEdit(post)} disabled={disabled} aria-label="Edit Post">
									<IconPencil size={16} />
								</ActionIcon>
							</Tooltip>
							<Tooltip label="删除帖子">
								<ActionIcon variant="light" color="red" onClick={() => onDelete(post._id)} disabled={disabled} aria-label="Delete Post">
									<IconTrash size={16} />
								</ActionIcon>
							</Tooltip>
						</>
					)}
					<Tooltip label="查看详情" withArrow position="bottom">
						<ActionIcon component={RouterLink} to={`/posts/${post.slug}`} variant="light" color="blue" aria-label="View Post">
							<IconExternalLink size={16} />
						</ActionIcon>
					</Tooltip>
				</Group>
			</Stack>
		</Paper>
	);
};

export default PostItem;