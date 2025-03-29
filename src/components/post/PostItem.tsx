// src/components/PostItem.mantine.tsx
import React from 'react';
import { IPost } from '../../types/types';
import { Paper, Title, Text, Badge, Group, ActionIcon, Tooltip, Stack, Anchor } from '@mantine/core'; // 使用 Paper, ActionIcon
import { IconPencil, IconTrash, IconExternalLink } from '@tabler/icons-react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface PostItemProps {
	post: IPost;
	onEdit: (post: IPost) => void;
	onDelete: (id: string) => void;
	// isLoading: boolean; // 父组件处理 loading
	isEditingOther: boolean;
}

const PostItem: React.FC<PostItemProps> = ({ post, onEdit, onDelete, isEditingOther }) => {
	const disabled = isEditingOther; // 按钮是否禁用 
	const {token} = useAuth();

	return (
		<Paper shadow="xs" p="lg" radius="md" withBorder /* className={classes.paper} */ >
			<Stack gap="md">
				<Group justify="space-between">
					{/* 标题链接 */}
					<Anchor component={RouterLink} to={`/posts/${post.slug}`} underline="hover" /* className={classes.titleLink} */ >
						<Title order={3} size="h4" lineClamp={1}> {/* lineClamp 限制行数 */}
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
				</Text>

				{post.excerpt && <Text size="sm" c="dimmed" lineClamp={2}>{post.excerpt}</Text>}

				{/* <Text size="sm" lineClamp={3}>{post.content}</Text> */} {/* 可选的内容预览 */}

				{post.tags && post.tags.length > 0 && (
					<Group gap={4}> {/* 使用更小的间距 */}
						{post.tags.map(tag => <Badge key={tag} color="blue" variant="light" size="xs">{tag}</Badge>)}
					</Group>
				)}

				<Group justify="flex-end" gap="xs" mt="sm">
					{/* --- 条件渲染编辑和删除按钮 --- */}
					{token && (
						<>
							<Tooltip label="编辑帖子" /* ... */ >
								<ActionIcon variant="light" color="yellow" onClick={() => onEdit(post)} disabled={disabled} aria-label="Edit Post">
									<IconPencil size={16} />
								</ActionIcon>
							</Tooltip>
							<Tooltip label="删除帖子" /* ... */ >
								<ActionIcon variant="light" color="red" onClick={() => onDelete(post._id)} disabled={disabled} aria-label="Delete Post">
									<IconTrash size={16} />
								</ActionIcon>
							</Tooltip>
						</>
					)}
					{/* 添加一个查看详情的按钮（虽然标题已经是链接了） */}
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