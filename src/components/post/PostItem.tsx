// src/components/PostItem.mantine.tsx
import React from 'react';
import { IPost } from '../../types/types';
import { Paper, Title, Text, Badge, Group, ActionIcon, Tooltip, Stack, Anchor } from '@mantine/core';
import { IconPencil, IconTrash, IconExternalLink, IconMessageCircle } from '@tabler/icons-react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface PostItemProps {
	post: IPost;
	onEdit: (post: IPost) => void;
	onDelete: (id: string) => void;
	// isEditingOther 似乎没用到，可以考虑移除，除非你有其他逻辑
	isEditingOther: boolean;
}

const PostItem: React.FC<PostItemProps> = ({ post, onEdit, onDelete }) => {
	const { token, user } = useAuth();

	// 检查当前用户是否为作者
	// 注意：确保比较时类型一致，比如都转为 string
	const isCurrentUserAuthor = !!(user && post.authorId && user.id === post.authorId.toString());

	return (
		<Paper shadow="xs" p="lg" radius="md" withBorder>
			<Stack gap="md">
				<Group justify="space-between">
					<Anchor component={RouterLink} to={`/posts/${post.slug}`} underline="hover">
						{/* 标题可以长一点，也加个 lineClamp */}
						<Title order={3} size="h4" lineClamp={1}>
							{post.title}
						</Title>
					</Anchor>
					<Badge color={post.isPublished ? 'green' : 'yellow'} variant="light" size="sm">
						{post.isPublished ? '已发布' : '草稿'}
					</Badge>
				</Group>

				<Group justify="space-between" align="center" wrap="wrap">
					<Text size="xs" c="dimmed">
						创建于: {new Date(post.createdAt).toLocaleDateString()}
						{post.isPublished && post.publishedAt && ` • 发布于: ${new Date(post.publishedAt).toLocaleDateString()}`}
					</Text>
					<Group gap="sm" align="center">
						<Group gap={4} align="center">
							<Tooltip label="评论数" withArrow position="bottom">
								<IconMessageCircle size={14} stroke={1.5} style={{ verticalAlign: 'middle', marginBottom: '2px' }} />
							</Tooltip>
							<Text size="xs" c="dimmed" component="span">
								{post.commentCount ?? 0}
							</Text>
						</Group>
					</Group>
				</Group>

				{/* --- 移除 Excerpt, 改为显示 Content 预览 --- */}
				{/* {post.excerpt && <Text size="sm" c="dimmed" lineClamp={2}>{post.excerpt}</Text>} */}
				{post.content && (
					<Text size="sm" c="dimmed" lineClamp={3}> {/* 显示3行内容，带省略号 */}
						{/* 可以考虑移除 HTML 标签，如果 content 是富文本 */}
						{post.content.replace(/<[^>]*>?/gm, '')} {/* 简单移除 HTML 标签 */}
					</Text>
				)}
				{/* --- 结束更改 --- */}


				{post.tags && post.tags.length > 0 && (
					<Group gap={4} mt="xs"> {/* 给标签加一点上边距 */}
						{post.tags.map(tag => <Badge key={tag} color="blue" variant="light" size="xs">{tag}</Badge>)}
					</Group>
				)}

				<Group justify="flex-end" gap="xs" mt="sm">
					{token && isCurrentUserAuthor && (
						<>
							<Tooltip label="编辑帖子">
								<ActionIcon variant="light" color="yellow" onClick={() => onEdit(post)} /* disabled={isEditingOther} */ aria-label="Edit Post">
									<IconPencil size={16} />
								</ActionIcon>
							</Tooltip>
							<Tooltip label="删除帖子">
								<ActionIcon variant="light" color="red" onClick={() => onDelete(post._id.toString())} /* disabled={isEditingOther} */ aria-label="Delete Post">
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